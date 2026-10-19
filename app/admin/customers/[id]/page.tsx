import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { Metric, PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { Badge, RewardStatusBadge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/ui/Button";
import { adjustPoints, setAccountStatus, setRole, voidReward } from "@/app/admin/actions";
import { describeCustomizations, formatDate, formatDateTime, formatVisitDate } from "@/lib/format";
import type { LoyaltyAccount, Profile, Redemption, Reward } from "@/lib/types";

export const metadata: Metadata = { title: "Customer" };

const TX_LABELS: Record<string, string> = {
  visit: "Visit",
  manual_adjustment: "Manual adjustment",
  redemption_reset: "Reward redeemed, card reset",
  reward_cancelled_reset: "Reward voided, card reset",
};

const inputCls = "h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-olive focus:ring-4 focus:ring-olive/15";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile: me } = await requireRole(["admin"], `/admin/customers/${id}`);

  const [profileRes, accountRes, visitsRes, rewardsRes, redemptionsRes, txRes, settingsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>(),
    supabase.from("loyalty_accounts").select("*").eq("customer_id", id).maybeSingle<LoyaltyAccount>(),
    supabase
      .from("visits")
      .select("id, visit_date, method, cycle_number, created_at, note, recorder:profiles!visits_recorded_by_fkey(full_name)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("rewards").select("*").eq("customer_id", id).order("earned_at", { ascending: false }),
    supabase.from("redemptions").select("*").eq("customer_id", id).order("requested_at", { ascending: false }),
    supabase
      .from("loyalty_transactions")
      .select("id, type, points_delta, balance_after, cycle_number, reason, created_at, by:profiles!loyalty_transactions_created_by_fkey(full_name)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("app_settings").select("business_timezone").single(),
  ]);

  const p = profileRes.data;
  if (!p) notFound();
  const a = accountRes.data;
  const tz = settingsRes.data?.business_timezone ?? "Africa/Lagos";
  const rewards = (rewardsRes.data ?? []) as Reward[];
  const redemptions = (redemptionsRes.data ?? []) as Redemption[];
  const openReward = rewards.find((r) => r.status === "available" || r.status === "pending");
  const visits = (visitsRes.data ?? []) as unknown as Array<{ id: string; visit_date: string; method: string; cycle_number: number; created_at: string; note: string | null; recorder: { full_name: string } | null }>;
  const txs = (txRes.data ?? []) as unknown as Array<{ id: string; type: string; points_delta: number; balance_after: number; cycle_number: number; reason: string | null; created_at: string; by: { full_name: string } | null }>;
  const isSelf = me.id === p.id;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/customers" className="font-semibold text-olive-deep">
          Customers
        </Link>
      </p>
      <PageHeader
        title={p.full_name}
        description={`${p.email}${p.phone ? `, ${p.phone}` : ""}. Joined ${formatDate(p.created_at, tz)}.`}
        actions={
          <div className="flex gap-2">
            {p.status === "suspended" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="sage">Active</Badge>}
            <Badge tone="olive">{p.role === "admin" ? "Admin" : p.role === "staff" ? "Staff" : "Customer"}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric emphasis label="Current points" value={`${a?.current_points ?? 0} / 15`} />
        <Metric label="Current card" value={a?.cycle_number ?? 1} />
        <Metric label="Verified visits" value={a?.total_visits ?? 0} />
        <Metric label="Drinks redeemed" value={a?.rewards_redeemed ?? 0} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel title="Rewards">
            <Table head={["Reference", "Card", "Status", "Drink", "Date"]} empty="No rewards earned yet.">
              {rewards.map((r) => {
                const d = redemptions.find((x) => x.reward_id === r.id && x.status !== "cancelled") ?? redemptions.find((x) => x.reward_id === r.id);
                return (
                  <tr key={r.id}>
                    <Td className="tabular">{r.reference}</Td>
                    <Td className="tabular">{r.cycle_number}</Td>
                    <Td>
                      <RewardStatusBadge status={r.status} />
                    </Td>
                    <Td>
                      {d ? (
                        <>
                          {d.drink_name}
                          <span className="block text-xs text-muted">
                            {d.reference}
                            {Object.keys(d.customizations ?? {}).length ? `, ${describeCustomizations(d.customizations)}` : ""}
                          </span>
                        </>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(r.redeemed_at ?? r.cancelled_at ?? r.earned_at, tz)}</Td>
                  </tr>
                );
              })}
            </Table>
          </Panel>

          <Panel title="Points ledger">
            <Table head={["When", "Change", "Balance", "Card", "Type", "By", "Reason"]} empty="No point changes yet.">
              {txs.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(t.created_at, tz)}</Td>
                  <Td className={`tabular font-semibold ${t.points_delta < 0 ? "text-danger" : "text-success"}`}>
                    {t.points_delta > 0 ? `+${t.points_delta}` : t.points_delta}
                  </Td>
                  <Td className="tabular">{t.balance_after}</Td>
                  <Td className="tabular">{t.cycle_number}</Td>
                  <Td>{TX_LABELS[t.type] ?? t.type}</Td>
                  <Td>{t.by?.full_name ?? (t.type === "visit" ? "QR scan" : "")}</Td>
                  <Td className="text-muted">{t.reason ?? ""}</Td>
                </tr>
              ))}
            </Table>
          </Panel>

          <Panel title="Visit history">
            <Table head={["Business day", "Recorded", "Method", "Card", "Note"]} empty="No verified visits yet.">
              {visits.map((v) => (
                <tr key={v.id}>
                  <Td className="whitespace-nowrap">{formatVisitDate(v.visit_date)}</Td>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(v.created_at, tz)}</Td>
                  <Td>{v.method === "qr" ? "QR scan" : `Staff check-in${v.recorder ? ` by ${v.recorder.full_name}` : ""}`}</Td>
                  <Td className="tabular">{v.cycle_number}</Td>
                  <Td className="text-muted">{v.note ?? ""}</Td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Correct points">
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Corrections are added to the ledger with your name and reason. Past records are never edited. The balance must stay between 0 and 15.
            </p>
            {openReward ? (
              <p className="text-sm">This customer has an open reward. Redeem or void it before adjusting points.</p>
            ) : (
              <ActionForm action={adjustPoints}>
                <input type="hidden" name="customerId" value={p.id} />
                <div>
                  <label htmlFor="delta" className="mb-1 block text-sm font-medium">
                    Points to add or remove
                  </label>
                  <input id="delta" name="delta" type="number" min={-15} max={15} required placeholder="For example 2 or -1" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="reason" className="mb-1 block text-sm font-medium">
                    Reason
                  </label>
                  <input id="reason" name="reason" required minLength={5} maxLength={280} placeholder="For example: scanner outage on Friday" className={inputCls} />
                </div>
                <SubmitButton variant="olive" size="sm" pendingLabel="Saving...">
                  Record correction
                </SubmitButton>
              </ActionForm>
            )}
          </Panel>

          {openReward && (
            <Panel title="Void open reward">
              <p className="mb-4 text-sm leading-relaxed text-muted">
                Use only after investigating misuse. The reward is marked cancelled and the customer starts a new card at zero.
              </p>
              <ActionForm action={voidReward}>
                <input type="hidden" name="rewardId" value={openReward.id} />
                <input type="hidden" name="customerId" value={p.id} />
                <input name="reason" required minLength={5} maxLength={280} placeholder="Reason" aria-label="Reason for voiding" className={inputCls} />
                <SubmitButton variant="danger" size="sm" pendingLabel="Voiding...">
                  Void reward {openReward.reference}
                </SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {!isSelf && (
            <Panel title={p.status === "active" ? "Suspend account" : "Reactivate account"}>
              <ActionForm action={setAccountStatus}>
                <input type="hidden" name="userId" value={p.id} />
                <input type="hidden" name="status" value={p.status === "active" ? "suspended" : "active"} />
                <input name="reason" required minLength={5} maxLength={280} placeholder="Reason" aria-label="Reason" className={inputCls} />
                <SubmitButton variant={p.status === "active" ? "danger" : "olive"} size="sm" pendingLabel="Saving...">
                  {p.status === "active" ? "Suspend account" : "Reactivate account"}
                </SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {!isSelf && (
            <Panel title="Access">
              <ActionForm action={setRole}>
                <input type="hidden" name="userId" value={p.id} />
                <label htmlFor="role" className="mb-1 block text-sm font-medium">
                  Role
                </label>
                <select id="role" name="role" defaultValue={p.role} className={inputCls}>
                  <option value="customer">Customer</option>
                  <option value="staff">Staff: redeem drinks, check in guests, show the QR</option>
                  <option value="admin">Administrator: full access</option>
                </select>
                <SubmitButton variant="outline" size="sm" pendingLabel="Saving...">
                  Update role
                </SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
