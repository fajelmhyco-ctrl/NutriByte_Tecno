import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { foodQuerySchema } from "../validation/schemas";
import { cached } from "../db/cache";
import { prisma } from "../db/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const router = Router();

router.get("/", authenticate, validate(foodQuerySchema, "query"), async (req, res, next) => {
  try {
    const { q, category, verifiedOnly, limit, offset } = req.query as unknown as {
      q?: string;
      category?: string;
      verifiedOnly?: boolean;
      limit: number;
      offset: number;
    };

    const cacheKey = `foods:${q ?? ""}:${category ?? ""}:${verifiedOnly ?? false}:${limit}:${offset}`;

    const result = await cached(cacheKey, 300, async () => {
      const where: Prisma.FilipinoFoodWhereInput = {
        ...(category ? { category } : {}),
        ...(verifiedOnly ? { isVerified: true } : {}),
        ...(q
          ? {
              OR: [
                { dishName: { contains: q, mode: "insensitive" } },
                { localName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.filipinoFood.findMany({
          where,
          orderBy: [{ isVerified: "desc" }, { dishName: "asc" }],
          take: limit,
          skip: offset,
        }),
        prisma.filipinoFood.count({ where }),
      ]);

      return { items, total, limit, offset };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/categories", authenticate, async (_req, res, next) => {
  try {
    const rows = await prisma.filipinoFood.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    res.json(rows.map((r) => ({ category: r.category, count: r._count._all })));
  } catch (err) {
    next(err);
  }
});

const createFoodSchema = z.object({
  dishName: z.string().min(2).max(160),
  localName: z.string().max(160).optional(),
  category: z.string().min(2).max(60),
  servingUnit: z.string().min(1).max(80),
  servingGrams: z.number().positive().max(5000).default(100),
  calories: z.number().min(0).max(5000),
  proteinG: z.number().min(0).max(500),
  carbsG: z.number().min(0).max(500),
  fatG: z.number().min(0).max(500),
  fiberG: z.number().min(0).max(200).default(0),
  sodiumMg: z.number().min(0).max(20000),
  potassiumMg: z.number().min(0).max(20000),
  phosphorusMg: z.number().min(0).max(10000),
  glycemicIndex: z.number().int().min(0).max(110).optional(),
  commonIngredients: z.array(z.string()).default([]),
  preparationTips: z.string().max(1000).optional(),
});

router.post("/", requireRole("dietitian", "admin"), validate(createFoodSchema), async (req, res, next) => {
  try {
    const body = req.body;
    const glycemicLoad =
      body.glycemicIndex != null ? Math.round(((body.glycemicIndex * body.carbsG) / 100) * 10) / 10 : null;

    const food = await prisma.filipinoFood.create({
      data: {
        ...body,
        glycemicLoad,
        isVerified: req.auth!.role === "admin",
        createdById: req.auth!.sub,
      },
    });
    res.status(201).json(food);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const food = await prisma.filipinoFood.findUnique({ where: { id: req.params.id } });
    if (!food) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Food not found" } });
    res.json(food);
  } catch (err) {
    next(err);
  }
});

export default router;
