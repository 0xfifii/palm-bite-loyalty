import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OPEN_STATUSES } from "@/lib/order/status";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

/** Staff and admins: a small summary of open orders for the alert banner. */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: noStore });
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) return NextResponse.json({ code: "FORBIDDEN" }, { status: 403, headers: noStore });
  const { data } = await supabase
    .from("orders")
    .select("id, reference, status, payment_status, go_ahead_at, total_naira, created_at")
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(80);
  const rows = data ?? [];
  return NextResponse.json(
    {
      code: "OK",
      orders: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        payment: r.payment_status,
        goAhead: r.go_ahead_at,
        total: r.total_naira,
      })),
    },
    { headers: noStore },
  );
}
