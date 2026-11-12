import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type PendingVisit = { id: string; created_at: string; name: string; phoneLast4: string; points: number };

/** Visits waiting for Palm Staff approval, oldest first. Staff only (RLS returns nothing for others). */
export async function GET() {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("visit_requests")
      .select("id, created_at, customer:profiles!visit_requests_customer_id_fkey(full_name, phone, loyalty_accounts(current_points))")
      .eq("status", "pending")
      .gt("created_at", since)
      .order("created_at", { ascending: true })
      .limit(30);
    if (error) throw error;
    type Row = { id: string; created_at: string; customer: { full_name: string; phone: string | null; loyalty_accounts: { current_points: number } | { current_points: number }[] | null } | null };
    const visits: PendingVisit[] = ((data ?? []) as unknown as Row[]).map((r) => {
      const acct = Array.isArray(r.customer?.loyalty_accounts) ? r.customer?.loyalty_accounts[0] : r.customer?.loyalty_accounts;
      return {
        id: r.id,
        created_at: r.created_at,
        name: r.customer?.full_name ?? "Palm Fren",
        phoneLast4: (r.customer?.phone ?? "").slice(-4),
        points: acct?.current_points ?? 0,
      };
    });
    return NextResponse.json({ code: "OK", visits }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "TEMPORARY_ERROR", visits: [] }, { status: 503 });
  }
}
