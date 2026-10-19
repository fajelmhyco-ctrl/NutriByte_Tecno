import crypto from "node:crypto";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

export function buildRoomId(sessionId: string): string {
  return `nb-${sessionId.replace(/-/g, "").slice(0, 24)}`;
}

export function generateAgoraToken(params: {
  channelName: string;
  uid: number;
  role: "publisher" | "subscriber";
}): { token: string; expiresAt: number; appId: string } {
  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new AppError(503, "Telehealth video is not configured", "TELEHEALTH_UNAVAILABLE");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + env.AGORA_TOKEN_TTL_SECONDS;
  const role = params.role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  const token = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    params.channelName,
    params.uid,
    role,
    expiresAt,
    expiresAt,
  );

  return { token, expiresAt, appId: env.AGORA_APP_ID };
}

export function uidFromUserId(userId: string): number {
  const hash = crypto.createHash("sha256").update(userId).digest();
  return hash.readUInt32BE(0) % 100_000_000;
}
