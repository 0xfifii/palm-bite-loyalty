import "server-only";
import { z } from "zod";

/**
 * Server environment, validated on first use (not at import time, so the
 * production build does not need secrets present).
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url(),
  QR_SIGNING_SECRET: z.string().min(32, "QR_SIGNING_SECRET must be at least 32 characters"),
  QR_SIGNING_SECRET_PREVIOUS: z.string().optional(),
  PALM_BITE_LOCATION_ID: z.uuid().default("00000000-0000-4000-8000-000000000001"),
  RATE_LIMIT_SALT: z.string().min(16, "RATE_LIMIT_SALT must be at least 16 characters"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    QR_SIGNING_SECRET: process.env.QR_SIGNING_SECRET,
    QR_SIGNING_SECRET_PREVIOUS: process.env.QR_SIGNING_SECRET_PREVIOUS || undefined,
    PALM_BITE_LOCATION_ID: process.env.PALM_BITE_LOCATION_ID || undefined,
    RATE_LIMIT_SALT: process.env.RATE_LIMIT_SALT,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment. ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
