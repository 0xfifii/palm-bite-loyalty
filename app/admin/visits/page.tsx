import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { formatTime, formatVisitDate } from "@/lib/format";

export const metadata: Metadata = { title: "Visits" };

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { supabase } = await requireRole(["admin"], "/admin/visits");
  const sp = await searchParams;
  const { data: today } = await supabase.rpc("business_today");
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : String(today);
  const [{ data }, { data: settings }] = await Promise.all([
    supabase
      .from("visits")
      .select(
        "id, created_at, method, cycle_number, note, customer:profiles!visits_customer_id_fkey(id, full_name, phone), recorder:profiles!visits_recorded_by_fkey(full_name)",
      )
      .eq("visit_date", date)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("app_settings").select("business_timezone").single(),
  ]);
  const tz = settings?.business_timezone ?? "Africa/Lagos";
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    created_at: string;
    method: string;
    cycle_number: number;
    note: string | null;
    customer: { id: string; full_name: string; phone: string | null } | null;
    recorder: { full_name: string } | null;
  }>;
  const qr = rows.filter((r) => r.method === "qr").length;

  const shift = (days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  return (
    <>
      <PageHeader title="Visits" description={`Verified visits for ${formatVisitDate(date)}, in ${tz} business time.`} />
      <Panel>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link href={`/admin/visits?date=${shift(-1)}`} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">
            Previous day
          </Link>
          <form className="flex items-center gap-2">
            <label htmlFor="date" className="sr-only">
              Date
            </label>
            <input id="date" type="date" name="date" defaultValue={date} className="h-10 rounded-full border border-line px-4 text-sm" />
            <button className="h-10 rounded-full bg-ink px-4 text-sm font-semibold text-cream">Show</button>
          </form>
          <Link href={`/admin/visits?date=${shift(1)}`} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">
            Next day
          </Link>
          <p className="ml-auto text-sm text-muted">
            {rows.length} visits, {qr} by QR, {rows.length - qr} staff check-ins
          </p>
        </div>
        <Table head={["Time", "Customer", "Method", "Card", "Note"]} empty="No verified visits on this day.">
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="tabular whitespace-nowrap">{formatTime(r.created_at, tz)}</Td>
              <Td>
                {r.customer ? (
                  <Link href={`/admin/customers/${r.customer.id}`} className="font-semibold text-olive-deep hover:underline">
                    {r.customer.full_name}
                  </Link>
                ) : (
                  "Deleted account"
                )}
              </Td>
              <Td>
                {r.method === "qr" ? <Badge tone="sage">QR scan</Badge> : <Badge tone="peach">Check-in by {r.recorder?.full_name ?? "staff"}</Badge>}
              </Td>
              <Td className="tabular">{r.cycle_number}</Td>
              <Td className="text-muted">{r.note ?? ""}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
