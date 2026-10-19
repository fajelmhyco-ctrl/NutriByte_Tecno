import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { bookSessionSchema } from "../validation/schemas";
import { prisma } from "../db/prisma";
import { badRequest, forbidden, notFound } from "../utils/errors";
import { computeSplit, createCheckoutSession } from "../services/payments.service";
import { buildRoomId, generateAgoraToken, uidFromUserId } from "../services/telehealth.service";
import { env } from "../config/env";

const router = Router();
router.use(authenticate);

router.post("/", validate(bookSessionSchema), async (req, res, next) => {
  try {
    const patientId = req.auth!.sub;
    const { dietitianId, scheduledAt, durationMinutes } = req.body;

    if (scheduledAt.getTime() < Date.now()) throw badRequest("Scheduled time must be in the future");

    const dietitian = await prisma.dietitianProfile.findUnique({
      where: { userId: dietitianId },
      include: { user: { select: { fullName: true, email: true } } },
    });
    if (!dietitian) throw notFound("Dietitian not found");
    if (!dietitian.isAcceptingPatients) throw badRequest("This dietitian is not accepting new patients");

    const link = await prisma.patientDietitianLink.findUnique({
      where: { patientId_dietitianId: { patientId, dietitianId } },
    });
    if (link && link.status === "revoked") throw forbidden("This dietitian link has been revoked");

    const split = computeSplit(dietitian.consultationFeePhp);

    const session = await prisma.telehealthSession.create({
      data: {
        patientId,
        dietitianId,
        scheduledAt,
        durationMinutes,
        roomId: `pending-${cryptoRandomId()}`,
        amountPhp: split.amountPhp,
        platformCommissionPhp: split.commissionPhp,
        dietitianPayoutPhp: split.payoutPhp,
      },
    });

    const roomId = buildRoomId(session.id);
    const updated = await prisma.telehealthSession.update({
      where: { id: session.id },
      data: { roomId },
    });

    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 14);
}

router.get("/", async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const role = req.auth!.role;

    const sessions = await prisma.telehealthSession.findMany({
      where:
        role === "dietitian"
          ? { dietitianId: userId }
          : role === "admin"
            ? {}
            : { patientId: userId },
      include: {
        patient: { select: { id: true, fullName: true, email: true } },
        dietitian: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });

    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/checkout", async (req, res, next) => {
  try {
    const session = await prisma.telehealthSession.findUnique({
      where: { id: req.params.id },
      include: {
        patient: { select: { fullName: true, email: true } },
        dietitian: { select: { fullName: true } },
      },
    });
    if (!session) throw notFound("Session not found");
    if (session.patientId !== req.auth!.sub) throw forbidden("You can only pay for your own session");
    if (session.paymentStatus === "paid") throw badRequest("Session is already paid");

    const checkout = await createCheckoutSession({
      sessionId: session.id,
      amountPhp: session.amountPhp,
      description: `NutriByte consultation with ${session.dietitian.fullName}`,
      patientEmail: session.patient.email,
      patientName: session.patient.fullName,
      successUrl: `${env.APP_URL}/consultations?status=success&session=${session.id}`,
      cancelUrl: `${env.APP_URL}/consultations?status=cancelled&session=${session.id}`,
    });

    await prisma.telehealthSession.update({
      where: { id: session.id },
      data: { paymentStatus: "pending", paymongoPaymentId: checkout.checkoutId },
    });

    res.json(checkout);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/token", async (req, res, next) => {
  try {
    const session = await prisma.telehealthSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound("Session not found");

    const userId = req.auth!.sub;
    const isPatient = session.patientId === userId;
    const isDietitian = session.dietitianId === userId;
    if (!isPatient && !isDietitian && req.auth!.role !== "admin") {
      throw forbidden("You are not a participant in this session");
    }
    if (session.paymentStatus !== "paid") throw forbidden("Payment is required before joining");
    if (session.status === "cancelled") throw badRequest("This session was cancelled");

    const token = generateAgoraToken({
      channelName: session.roomId,
      uid: uidFromUserId(userId),
      role: "publisher",
    });

    res.json({ ...token, channelName: session.roomId, uid: uidFromUserId(userId) });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const status = String(req.body.status ?? "");
    const allowed = ["in_progress", "completed", "cancelled", "no_show"];
    if (!allowed.includes(status)) throw badRequest("Invalid status");

    const session = await prisma.telehealthSession.findUnique({ where: { id: req.params.id } });
    if (!session) throw notFound("Session not found");

    const userId = req.auth!.sub;
    if (session.patientId !== userId && session.dietitianId !== userId && req.auth!.role !== "admin") {
      throw forbidden("You are not a participant in this session");
    }
    if (status === "completed" && session.dietitianId !== userId && req.auth!.role !== "admin") {
      throw forbidden("Only the dietitian can complete a session");
    }

    const updated = await prisma.telehealthSession.update({
      where: { id: session.id },
      data: { status: status as never },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
