import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { Metric, PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/Button";
import { formatDateTime, formatVisitDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin overview" };

type Overview = {
  code: string;
  business_date: string;
  business_timezone: string;
  total_customers: number;
  visited_today: number;
  total_visits: number;
  points_today: number;
  available_rewards: number;
  pending_redemptions: number;
  redeemed_today: number;
  failed_scans_today: number;
};

const ACTION_LABELS: Record<string, string> = {
  "reward.earned": "Reward earned",
  "redemption.requested": "Drink chosen",
  "redemption.completed": "Drink served",
  "redemption.cancelled": "Request cancelled",
  "points.adjusted": "Points adjusted",
  "visit.staff_check_in": "Staff check-in",
  "account.status_changed": "Account status changed",
  "account.role_changed": "Role changed",
  "reward.cancelled": "Reward voided",
  "settings.updated": "Settings updated",
  "qr.revoked": "QR revoked",
  "report.viewed": "Report exported",
  "account.bootstrap_admin": "Administrator created",
  "visit.approved": "Visit approved",
  "visit.declined": "Visit declined",
  "staff_request.approved": "Staff request approved",
  "staff_request.declined": "Staff request declined",
};

export default async function AdminOverview() {
  const { supabase } = await requireRole(["admin"], "/admin");
  const [{ data: overview }, { data: activity }, { count: staffRequests }, { count: newOrders }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase
      .from("audit_logs")
      .select("id, action, details, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)")
      .neq("action", "report.viewed")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("staff_request", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  const o = overview as Overview | null;
  const tz = o?.business_timezone ?? "Africa/Lagos";
  const rows = (activity ?? []) as unknown as Array<{ id: number; action: string; details: Record<string, unknown>; created_at: string; actor: { full_name: string } | null }>;

  return (
    <>
      <PageHeader
        title="Overview"
        description={o ? `Business day ${formatVisitDate(o.business_date)} (${tz}). Figures are live from the database.` : undefined}
        actions={
          <>
            <ButtonLink href="/display" variant="olive" icon="qr">
              Open QR display
            </ButtonLink>
            <ButtonLink href="/admin/rewards" variant="outline" icon="gift">
              Redeem a drink
            </ButtonLink>
          </>
        }
      />

      {(newOrders ?? 0) > 0 && (
        <a href="/admin/orders" className="mb-3 block rounded-[var(--radius-card)] bg-olive-deep p-4 font-semibold text-cream">
          {newOrders} new {newOrders === 1 ? "order" : "orders"} waiting. Open Orders.
        </a>
      )}

      {(staffRequests ?? 0) > 0 && (
        <a href="/admin/settings" className="mb-6 block rounded-[var(--radius-card)] bg-peach p-4 font-semibold text-olive-night">
          {staffRequests} Palm Staff {staffRequests === 1 ? "request is" : "requests are"} waiting for your approval. Review in Settings.
        </a>
      )}

      {!o || o.code !== "OK" ? (
        <Panel>
          <p className="text-muted">Metrics are unavailable right now. Check the database connection and refresh.</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric emphasis label="Visited today" value={o.visited_today} hint={`${o.points_today} points awarded today`} href="/admin/visits" />
          <Metric label="Registered customers" value={o.total_customers} href="/admin/customers" />
          <Metric label="Verified visits, all time" value={o.total_visits} href="/admin/visits" />
          <Metric label="Points awarded today" value={o.points_today} />
          <Metric label="Customers with a free drink" value={o.available_rewards} href="/admin/rewards" />
          <Metric label="Waiting at the counter" value={o.pending_redemptions} href="/admin/rewards" />
          <Metric label="Drinks redeemed today" value={o.redeemed_today} />
          <Metric label="Failed scans today" value={o.failed_scans_today} hint="Expired, invalid or repeated codes" href="/admin/qr" />
        </div>
      )}

      <Panel title="Recent activity" className="mt-8">
        <Table head={["When", "What", "By", "Details"]} empty="Activity will appear here as customers visit.">
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-muted">{formatDateTime(r.created_at, tz)}</Td>
              <Td className="font-medium">{ACTION_LABELS[r.action] ?? r.action}</Td>
              <Td>{r.actor?.full_name ?? "System"}</Td>
              <Td className="text-muted">
                {[r.details?.drink, r.details?.reference, r.details?.reason].filter(Boolean).map(String).join(", ")}
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
