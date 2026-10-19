import crypto from "node:crypto";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader(): string {
  if (!env.PAYMONGO_SECRET_KEY) {
    throw new AppError(503, "Payments are not configured", "PAYMENTS_UNAVAILABLE");
  }
  return `Basic ${Buffer.from(`${env.PAYMONGO_SECRET_KEY}:`).toString("base64")}`;
}

export interface CheckoutResult {
  checkoutUrl: string;
  checkoutId: string;
  amountPhp: number;
  commissionPhp: number;
  payoutPhp: number;
}

export function computeSplit(amountPhp: number) {
  const commission = Math.round(amountPhp * env.PLATFORM_COMMISSION_RATE * 100) / 100;
  return {
    amountPhp,
    commissionPhp: commission,
    payoutPhp: Math.round((amountPhp - commission) * 100) / 100,
  };
}

/**
 * Creates a PayMongo Checkout Session. Supports GCash and Maya via payment
 * method types. Returns a hosted checkout URL.
 */
export async function createCheckoutSession(params: {
  sessionId: string;
  amountPhp: number;
  description: string;
  patientEmail: string;
  patientName: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutResult> {
  const split = computeSplit(params.amountPhp);

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          description: params.description,
          line_items: [
            {
              currency: "PHP",
              amount: Math.round(params.amountPhp * 100),
              name: "Tele-nutrition Consultation",
              quantity: 1,
            },
          ],
          payment_method_types: ["gcash", "paymaya", "card"],
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          metadata: { telehealthSessionId: params.sessionId },
          billing: { name: params.patientName, email: params.patientEmail },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AppError(502, `PayMongo error: ${body.slice(0, 200)}`, "PAYMENT_PROVIDER_ERROR");
  }

  const data = (await res.json()) as {
    data?: { id: string; attributes?: { checkout_url?: string } };
  };

  const checkoutUrl = data.data?.attributes?.checkout_url;
  const checkoutId = data.data?.id;
  if (!checkoutUrl || !checkoutId) {
    throw new AppError(502, "PayMongo did not return a checkout URL", "PAYMENT_PROVIDER_ERROR");
  }

  return { checkoutUrl, checkoutId, ...split };
}

/**
 * Verifies the PayMongo webhook signature. The signed payload is
 * `${timestamp}.${rawBody}` using HMAC-SHA256 with the webhook secret.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!env.PAYMONGO_WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.te ?? parts.li;
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", env.PAYMONGO_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
