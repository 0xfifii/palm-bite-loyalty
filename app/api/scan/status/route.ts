import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { respond } from "@/lib/loyalty/scan-service";
import type { ScanCode } from "@/lib/loyalty/codes";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const TTL_MS = 15 * 60 * 1000;
const PASS_THROUGH = new Set(["ALREADY_COLLECTED_TODAY", "REWARD_PENDING_REDEMPTION", "ACCOUNT_SUSPENDED"]);

/** A Palm Fren's own visit request status, polled while waiting for approval. RLS limits it to their own rows. */
export async function GET(request: Request) {
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json(respond("QR_INVALID"), { status: 400, headers: noStore });

  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) return NextResponse.json(respond("UNAUTHENTICATED"), { status: 401, headers: noStore });

    const { data: req } = await supabase
      .from("visit_requests")
      .select("id, status, result_code, created_at")
      .eq("id", id.data)
      .maybeSingle();
    if (!req) return NextResponse.json(respond("QR_INVALID"), { status: 404, headers: noStore });

    let code: ScanCode;
    if (req.status === "pending") code = Date.now() - Date.parse(req.created_at) > TTL_MS ? "REQUEST_EXPIRED" : "APPROVAL_PENDING";
    else if (req.status === "approved") code = "POINT_AWARDED";
    else if (req.status === "expired") code = "REQUEST_EXPIRED";
    else code = PASS_THROUGH.has(req.result_code ?? "") ? (req.result_code as ScanCode) : "VISIT_REJECTED";

    if (code !== "POINT_AWARDED") return NextResponse.json(respond(code, { requestId: req.id }), { headers: noStore });

    const [{ data: account }, { data: openReward }] = await Promise.all([
      supabase.from("loyalty_accounts").select("current_points, cycle_number, total_visits, rewards_redeemed").eq("customer_id", userId).single(),
      supabase.from("rewards").select("id").eq("customer_id", userId).in("status", ["available", "pending"]).maybeSingle(),
    ]);
    return NextResponse.json(
      respond("POINT_AWARDED", {
        requestId: req.id,
        rewardUnlocked: Boolean(openReward),
        account: account
          ? { points: account.current_points, cycle: account.cycle_number, total_visits: account.total_visits, rewards_redeemed: account.rewards_redeemed }
          : undefined,
      }),
      { headers: noStore },
    );
  } catch {
    return NextResponse.json(respond("TEMPORARY_ERROR"), { status: 503, headers: noStore });
  }
}
