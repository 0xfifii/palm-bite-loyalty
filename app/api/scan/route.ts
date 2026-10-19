import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, hashIp, rateLimit, sameOrigin } from "@/lib/security";
import { processScan, respond } from "@/lib/loyalty/scan-service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!(await sameOrigin(request))) {
    return NextResponse.json(respond("QR_INVALID"), { status: 403, headers: noStore });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    const env = serverEnv();
    const supabase = await createClient();
    const admin = createAdminClient();
    const ipHash = hashIp(await clientIp());
    const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300);

    const result = await processScan(
      {
        getUserId: async () => {
          const { data } = await supabase.auth.getUser();
          return data.user?.id ?? null;
        },
        rateLimit,
        award: async (a) => {
          const { data, error } = await admin.rpc("award_qr_visit", {
            p_customer: a.customerId,
            p_session_id: a.sessionId,
            p_token_hash: a.tokenHash,
            p_location: a.locationId,
            p_idempotency_key: a.idempotencyKey,
            p_ip_hash: a.ipHash,
            p_user_agent: a.userAgent,
          });
          if (error) throw new Error(error.message);
          return data as Record<string, unknown>;
        },
        logAttempt: async (a) => {
          await admin.rpc("log_scan_attempt", {
            p_customer: a.customerId,
            p_session: a.sessionId,
            p_code: a.code,
            p_ip_hash: a.ipHash,
            p_user_agent: a.userAgent,
          });
        },
        secrets: [env.QR_SIGNING_SECRET, env.QR_SIGNING_SECRET_PREVIOUS ?? ""].filter(Boolean),
        locationId: env.PALM_BITE_LOCATION_ID,
      },
      { body, ipHash, userAgent },
    );

    const status = result.code === "UNAUTHENTICATED" ? 401 : result.code === "RATE_LIMITED" ? 429 : 200;
    return NextResponse.json(result, { status, headers: noStore });
  } catch {
    return NextResponse.json(respond("TEMPORARY_ERROR"), { status: 503, headers: noStore });
  }
}
