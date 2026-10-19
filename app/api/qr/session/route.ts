import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createQrToken } from "@/lib/qr/token";
import { buildScanUrl } from "@/lib/qr/parse";
import { rateLimit, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

/**
 * Mints a new short-lived visit QR for the in-store display. Staff or admin
 * only (checked here and again inside create_qr_session in the database).
 * The token is signed with QR_SIGNING_SECRET, which never leaves the server;
 * the database stores only the token's SHA-256 hash and expiry.
 */
export async function POST(request: Request) {
  if (!(await sameOrigin(request))) {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403, headers: noStore });
  }

  try {
    const env = serverEnv();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: noStore });

    if (!(await rateLimit(`qr:mint:${user.id}`, 20, 60))) {
      return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429, headers: noStore });
    }

    const minted = createQrToken(env.QR_SIGNING_SECRET, env.PALM_BITE_LOCATION_ID);
    const { data, error } = await supabase.rpc("create_qr_session", {
      p_session_id: minted.sessionId,
      p_token_hash: minted.tokenHash,
    });
    if (error) throw new Error(error.message);
    const result = data as { code: string; expires_at: string; server_now: string; ttl_seconds: number };
    if (result.code !== "OK") {
      return NextResponse.json({ code: result.code }, { status: 403, headers: noStore });
    }

    const scanUrl = buildScanUrl(env.NEXT_PUBLIC_SITE_URL, minted.token);
    const svg = await QRCode.toString(scanUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#1D2119", light: "#FFFFFF" },
    });

    return NextResponse.json(
      {
        code: "OK",
        sessionId: minted.sessionId,
        svg,
        expiresAt: result.expires_at,
        serverNow: result.server_now,
        ttlSeconds: result.ttl_seconds,
      },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json({ code: "TEMPORARY_ERROR" }, { status: 503, headers: noStore });
  }
}
