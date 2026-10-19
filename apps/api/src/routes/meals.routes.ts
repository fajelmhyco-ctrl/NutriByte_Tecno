import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { mealLogSchema } from "../validation/schemas";
import { createMealLog, getDailySummary, getHistory } from "../services/meal.service";
import { prisma } from "../db/prisma";
import { z } from "zod";

const router = Router();
router.use(authenticate);

router.post("/", validate(mealLogSchema), async (req, res, next) => {
  try {
    const result = await createMealLog(req.auth!.sub, req.body);
    res.status(result.duplicate ? 200 : 201).json({
      log: result.log,
      evaluation: result.evaluation,
      duplicate: result.duplicate,
    });
  } catch (err) {
    next(err);
  }
});

const dateQuery = z.object({
  date: z.coerce.date().optional(),
});

router.get("/today", validate(dateQuery, "query"), async (req, res, next) => {
  try {
    const date = (req.query as { date?: Date }).date ?? new Date();
    const summary = await getDailySummary(req.auth!.sub, date);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

const historyQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
});

router.get("/history", validate(historyQuery, "query"), async (req, res, next) => {
  try {
    const days = (req.query as unknown as { days: number }).days;
    res.json(await getHistory(req.auth!.sub, days));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await prisma.dailyMealLog.deleteMany({
      where: { id: req.params.id, userId: req.auth!.sub },
    });
    if (result.count === 0) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Meal log not found" } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/alerts", async (req, res, next) => {
  try {
    const alerts = await prisma.clinicalAlert.findMany({
      where: { userId: req.auth!.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.patch("/alerts/:id/read", async (req, res, next) => {
  try {
    const result = await prisma.clinicalAlert.updateMany({
      where: { id: req.params.id, userId: req.auth!.sub },
      data: { isRead: true },
    });
    if (result.count === 0) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Alert not found" } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
