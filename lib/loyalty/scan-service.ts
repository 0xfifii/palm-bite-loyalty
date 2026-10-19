import { z } from "zod";
import { SCAN_MESSAGES, isScanCode, type ScanCode } from "./codes";
import { verifyQrToken } from "@/lib/qr/token";
import { extractScannedToken } from "@/lib/qr/parse";

/**
 * Visit scan workflow, independent of Next.js and Supabase so it can be unit
 * tested. The route handler supplies real dependencies.
 *
 * Order of checks:
 * 1. authenticated customer
 * 2. rate limits
 * 3. request shape and idempotency key
 * 4. token structure and HMAC signature (rejects tampering before any DB work)
 * 5. token location matches this Palm Bite location
 * 6. database: session exists, hash matches, not revoked, not expired,
 *    one point per business-local day, no open reward, atomic award
 */

export const scanRequestSchema = z.object({
  token: z.string().min(1).max(1000),
  idempotencyKey: z.uuid(),
});

export type ScanResponse = {
  code: ScanCode;
  title: string;
  message: string;
  replayed?: boolean;
  rewardUnlocked?: boolean;
  account?: { points: number; cycle: number; total_visits: number; rewards_redeemed: number };
};

export type ScanDeps = {
  getUserId: () => Promise<string | null>;
  rateLimit: (key: string, limit: number, windowSeconds: number) => Promise<boolean>;
  award: (args: {
    customerId: string;
    sessionId: string;
    tokenHash: string;
    locationId: string;
    idempotencyKey: string;
    ipHash: string;
    userAgent: string;
  }) => Promise<Record<string, unknown>>;
  logAttempt: (args: { customerId: string | null; sessionId: string | null; code: string; ipHash: string; userAgent: string }) => Promise<void>;
  secrets: string[];
  locationId: string;
};

export function respond(code: ScanCode, extra: Partial<ScanResponse> = {}): ScanResponse {
  const m = SCAN_MESSAGES[code];
  return { code, title: m.title, message: m.body, ...extra };
}

export async function processScan(
  deps: ScanDeps,
  input: { body: unknown; ipHash: string; userAgent: string },
): Promise<ScanResponse> {
  const userId = await deps.getUserId();
  if (!userId) return respond("UNAUTHENTICATED");

  const [userOk, ipOk] = await Promise.all([
    deps.rateLimit(`scan:user:${userId}`, 12, 60),
    deps.rateLimit(`scan:ip:${input.ipHash}`, 60, 60),
  ]);
  if (!userOk || !ipOk) return respond("RATE_LIMITED");

  const parsed = scanRequestSchema.safeParse(input.body);
  if (!parsed.success) {
    await safeLog(deps, { customerId: userId, sessionId: null, code: "QR_INVALID", ipHash: input.ipHash, userAgent: input.userAgent });
    return respond("QR_INVALID");
  }

  const token = extractScannedToken(parsed.data.token);
  // The signature also binds this Palm Bite location, so a code for any other
  // location fails here.
  const verified = token ? verifyQrToken(token, deps.secrets, deps.locationId) : null;
  if (!verified || !verified.ok) {
    await safeLog(deps, {
      customerId: userId,
      sessionId: null,
      code: "QR_INVALID",
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    });
    return respond("QR_INVALID");
  }

  let result: Record<string, unknown>;
  try {
    result = await deps.award({
      customerId: userId,
      sessionId: verified.payload.sid,
      tokenHash: verified.tokenHash,
      locationId: deps.locationId,
      idempotencyKey: parsed.data.idempotencyKey,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    });
  } catch {
    // The client retries with the same idempotency key, so a commit that
    // happened before the error is returned as POINT_AWARDED, never doubled.
    return respond("TEMPORARY_ERROR");
  }

  const code = typeof result?.code === "string" && isScanCode(result.code) ? result.code : "TEMPORARY_ERROR";
  const account = result?.account as ScanResponse["account"] | undefined;
  return respond(code, {
    account,
    replayed: result?.replayed === true,
    rewardUnlocked: result?.reward_unlocked === true,
  });
}

async function safeLog(deps: ScanDeps, args: Parameters<ScanDeps["logAttempt"]>[0]) {
  try {
    await deps.logAttempt(args);
  } catch {
    // Logging must never change the outcome.
  }
}
