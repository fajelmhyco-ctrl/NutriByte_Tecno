import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { prisma } from "../db/prisma";
import { notFound } from "../utils/errors";

const router = Router();
router.use(authenticate, requireRole("admin"));

router.get("/stats", async (_req, res, next) => {
  try {
    const [users, patients, dietitians, foods, logs, sessions, revenue] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: { in: ["patient", "consumer"] } } }),
      prisma.user.count({ where: { role: "dietitian" } }),
      prisma.filipinoFood.count(),
      prisma.dailyMealLog.count(),
      prisma.telehealthSession.count(),
      prisma.telehealthSession.aggregate({
        where: { paymentStatus: "paid" },
        _sum: { platformCommissionPhp: true, amountPhp: true },
      }),
    ]);

    res.json({
      users,
      patients,
      dietitians,
      foods,
      mealLogs: logs,
      telehealthSessions: sessions,
      revenue: {
        grossPhp: revenue._sum.amountPhp ?? 0,
        commissionPhp: revenue._sum.platformCommissionPhp ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const users = await prisma.user.findMany({
      where: role ? { role: role as never } : {},
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tier: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { mealLogs: true, patientSessions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.patch("/foods/:id/verify", async (req, res, next) => {
  try {
    const food = await prisma.filipinoFood.findUnique({ where: { id: req.params.id } });
    if (!food) throw notFound("Food not found");
    const updated = await prisma.filipinoFood.update({
      where: { id: food.id },
      data: { isVerified: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
