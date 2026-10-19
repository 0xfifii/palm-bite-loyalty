import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { currentTimeMs } from "@/lib/format";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { RedeemDesk } from "@/components/staff/RedeemDesk";
import { PendingRedemptions } from "@/components/staff/PendingRedemptions";
import { Badge } from "@/components/ui/Badge";
import { describeCustomizations, formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Rewards" };

export default async function AdminRewardsPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { supabase } = await requireRole(["admin"], "/admin/rewards");
  const { ref } = await searchParams;
  const since = new Date(currentTimeMs() - 7 * 24 * 3600 * 1000).toISOString();

  const [{ data: available }, { data: completed }, { data: failed }, { data: settings }] = await Promise.all([
    supabase
      .from("rewards")
      .select("id, reference, cycle_number, earned_at, customer:profiles!rewards_customer_id_fkey(id, full_name)")
      .eq("status", "available")
      .order("earned_at", { ascending: true })
      .limit(50),
    supabase
      .from("redemptions")
      .select("id, reference, drink_name, customizations, completed_at, customer:profiles!redemptions_customer_id_fkey(id, full_name), staff:profiles!redemptions_completed_by_fkey(full_name)")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(40),
    supabase
      .from("scan_attempts")
      .select("customer_id, result_code, customer:profiles!scan_attempts_customer_id_fkey(id, full_name)")
      .gte("created_at", since)
      .in("result_code", ["QR_INVALID", "QR_EXPIRED", "QR_REVOKED"])
      .limit(2000),
    supabase.from("app_settings").select("business_timezone").single(),
  ]);
  const tz = settings?.business_timezone ?? "Africa/Lagos";
  type Person = { id: string; full_name: string } | null;
  const availableRows = (available ?? []) as unknown as Array<{ id: string; reference: string; cycle_number: number; earned_at: string; customer: Person }>;
  const completedRows = (completed ?? []) as unknown as Array<{ id: string; reference: string; drink_name: string; customizations: Record<string, string>; completed_at: string; customer: Person; staff: { full_name: string } | null }>;

  // Simple anomaly signal: many rejected scans from one account in 7 days.
  const counts = new Map<string, { person: Person; n: number }>();
  for (const f of (failed ?? []) as unknown as Array<{ customer_id: string | null; customer: Person }>) {
    if (!f.customer_id) continue;
    const entry = counts.get(f.customer_id) ?? { person: f.customer, n: 0 };
    entry.n += 1;
    counts.set(f.customer_id, entry);
  }
  const suspicious = [...counts.values()].filter((c) => c.n >= 5).sort((a, b) => b.n - a.n).slice(0, 10);

  return (
    <>
      <PageHeader title="Rewards" description="Verify codes, confirm served drinks and review reward history." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <RedeemDesk key={ref ?? ""} initialReference={ref && /^PB-[0-9A-Z]{6}$/.test(ref) ? ref : ""} />
        <PendingRedemptions basePath="/admin/rewards" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel title="Earned, not yet chosen">
          <Table head={["Customer", "Reward", "Card", "Earned"]} empty="No unclaimed rewards.">
            {availableRows.map((r) => (
              <tr key={r.id}>
                <Td>
                  {r.customer && (
                    <Link href={`/admin/customers/${r.customer.id}`} className="font-semibold text-olive-deep hover:underline">
                      {r.customer.full_name}
                    </Link>
                  )}
                </Td>
                <Td className="tabular">{r.reference}</Td>
                <Td className="tabular">{r.cycle_number}</Td>
                <Td className="whitespace-nowrap text-muted">{formatDate(r.earned_at, tz)}</Td>
              </tr>
            ))}
          </Table>
        </Panel>

        <Panel title="Needs a look">
          <p className="mb-3 text-sm text-muted">Accounts with five or more rejected scans in the last 7 days. Review their history before taking action.</p>
          {suspicious.length === 0 ? (
            <p className="text-sm text-muted">Nothing unusual this week.</p>
          ) : (
            <ul className="divide-y divide-line">
              {suspicious.map((s) => (
                <li key={s.person?.id} className="flex items-center justify-between py-3">
                  {s.person ? (
                    <Link href={`/admin/customers/${s.person.id}`} className="font-semibold text-olive-deep hover:underline">
                      {s.person.full_name}
                    </Link>
                  ) : (
                    <span>Unknown</span>
                  )}
                  <Badge tone="danger">{s.n} rejected scans</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recently redeemed" className="mt-6">
        <Table head={["Served", "Customer", "Drink", "Code", "Served by"]} empty="No drinks redeemed yet.">
          {completedRows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-muted">{formatDateTime(r.completed_at, tz)}</Td>
              <Td>{r.customer?.full_name ?? ""}</Td>
              <Td>
                {r.drink_name}
                {Object.keys(r.customizations ?? {}).length > 0 && <span className="block text-xs text-muted">{describeCustomizations(r.customizations)}</span>}
              </Td>
              <Td className="tabular">{r.reference}</Td>
              <Td>{r.staff?.full_name ?? ""}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
