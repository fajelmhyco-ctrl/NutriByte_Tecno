import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { loginSchema, refreshSchema, registerSchema } from "../validation/schemas";
import {
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/auth.service";
import { prisma } from "../db/prisma";
import { notFound } from "../utils/errors";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts, try again later" } },
});

router.post("/register", authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await loginUser(req.body.email, req.body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await rotateRefreshToken(req.body.refreshToken);
    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        tier: result.user.tier,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", validate(refreshSchema), async (req, res, next) => {
  try {
    await revokeRefreshToken(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tier: true,
        isVerified: true,
        createdAt: true,
        profile: true,
        clinicalFlags: true,
        dietitianProfile: true,
      },
    });
    if (!user) throw notFound("User not found");
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
