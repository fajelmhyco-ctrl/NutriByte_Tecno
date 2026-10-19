import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { verifyAccessToken, TokenPayload } from "../services/auth.service";
import { forbidden, unauthorized } from "../utils/errors";

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized());

  const token = header.slice("Bearer ".length).trim();
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(forbidden(`This action requires one of: ${roles.join(", ")}`));
    }
    next();
  };
}

export function requirePremium(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  if (req.auth.tier !== "premium" && req.auth.role !== UserRole.admin) {
    return next(forbidden("The AI Coach is a Premium feature. Upgrade to continue."));
  }
  next();
}
