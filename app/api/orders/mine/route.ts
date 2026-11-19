import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

/** A Palm Fren's recent orders, for the in-app "your order moved" banner. */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: noStore });
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("orders")
    .select("id, reference, status, fulfilment, payment_status, accepted_by_name")
    .eq("customer_id", uid)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  return NextResponse.json({ code: "OK", orders: data ?? [] }, { headers: noStore });
}
