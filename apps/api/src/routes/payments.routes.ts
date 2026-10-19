import { Router } from "express";
import express from "express";
import { prisma } from "../db/prisma";
import { verifyWebhookSignature } from "../services/payments.service";

const router = Router();

/**
 * PayMongo webhook. Must receive the RAW body for signature verification, so this
 * router is mounted before express.json() in index.ts with its own raw parser.
 */
router.post(
  "/paymongo/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);

    if (!verifyWebhookSignature(raw, req.headers["paymongo-signature"] as string | undefined)) {
      return res.status(401).json({ error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } });
    }

    const event = JSON.parse(raw) as {
      data?: {
        attributes?: {
          type?: string;
          data?: {
            id?: string;
            attributes?: {
              status?: string;
              metadata?: { telehealthSessionId?: string };
            };
          };
        };
      };
    };

    const type = event.data?.attributes?.type;
    const resource = event.data?.attributes?.data;
    const sessionId = resource?.attributes?.metadata?.telehealthSessionId;

    if (type === "checkout_session.payment.paid" && sessionId) {
      await prisma.telehealthSession.update({
        where: { id: sessionId },
        data: { paymentStatus: "paid", paymongoPaymentId: resource?.id },
      });
    }

    if (type === "payment.failed" && sessionId) {
      await prisma.telehealthSession.update({
        where: { id: sessionId },
        data: { paymentStatus: "failed" },
      });
    }

    res.status(200).json({ received: true });
  },
);

export default router;
