import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { UserRole, UserTier } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { conflict, unauthorized } from "../utils/errors";

export interface TokenPayload {
  sub: string;
  role: UserRole;
  tier: UserTier;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: "nutribyte",
    audience: "nutribyte-app",
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      issuer: "nutribyte",
      audience: "nutribyte-app",
    }) as TokenPayload;
  } catch {
    throw unauthorized("Invalid or expired session");
  }
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return token;
}

export async function rotateRefreshToken(token: string) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw unauthorized("Refresh token is invalid or expired");
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: existing.userId } });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, tier: user.tier });
  const refreshToken = await issueRefreshToken(user.id);

  return { accessToken, refreshToken, user };
}

export async function registerUser(input: {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const role = input.role ?? UserRole.consumer;

  const user = await prisma.user.create({
    data: { email, passwordHash, fullName: input.fullName.trim(), role },
    select: { id: true, email: true, fullName: true, role: true, tier: true, createdAt: true },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, tier: user.tier });
  const refreshToken = await issueRefreshToken(user.id);

  return { user, accessToken, refreshToken };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) throw unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw unauthorized("Invalid email or password");

  const accessToken = signAccessToken({ sub: user.id, role: user.role, tier: user.tier });
  const refreshToken = await issueRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tier: user.tier,
      isVerified: user.isVerified,
    },
    accessToken,
    refreshToken,
  };
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
