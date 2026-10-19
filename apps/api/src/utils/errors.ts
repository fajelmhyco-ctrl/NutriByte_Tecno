import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "APP_ERROR",
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, "BAD_REQUEST", details);
export const unauthorized = (message = "Authentication required") =>
  new AppError(401, message, "UNAUTHORIZED");
export const forbidden = (message = "You do not have access to this resource") =>
  new AppError(403, message, "FORBIDDEN");
export const notFound = (message = "Resource not found") => new AppError(404, message, "NOT_FOUND");
export const conflict = (message: string) => new AppError(409, message, "CONFLICT");

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: err.flatten() },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  console.error("[unhandled]", err);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
