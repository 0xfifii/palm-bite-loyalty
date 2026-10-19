import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Client IP as reported by the hosting platform (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Salted hash so raw IP addresses are never stored. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${serverEnv().RATE_LIMIT_SALT}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Database-backed fixed window rate limiter (shared across serverless
 * instances). Fails open on infrastructure errors so a database hiccup does
 * not lock every customer out; the loyalty rules themselves never fail open.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

/** Rejects cross-site POSTs to JSON API routes (server actions are already protected by Next.js). */
export async function sameOrigin(request: Request): Promise<boolean> {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
