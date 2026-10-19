import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { currentTimeMs } from "@/lib/format";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ButtonLink, SubmitButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ActionForm } from "@/components/admin/ActionForm";
import { revokeQr } from "@/app/admin/actions";
import { formatDateTime, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "QR display" };

const RESULT_LABELS: Record<string, { label: string; tone: "sage" | "peach" | "danger" | "muted" }> = {
  POINT_AWARDED: { label: "Point awarded", tone: "sage" },
  POINT_AWARDED_REPLAY: { label: "Retry, no new point", tone: "muted" },
  ALREADY_COLLECTED_TODAY: { label: "Already collected", tone: "peach" },
  REWARD_PENDING_REDEMPTION: { label: "Reward waiting", tone: "peach" },
  QR_EXPIRED: { label: "Expired code", tone: "danger" },
  QR_INVALID: { label: "Invalid code", tone: "danger" },
  QR_REVOKED: { label: "Revoked code", tone: "danger" },
  ACCOUNT_SUSPENDED: { label: "Suspended account", tone: "danger" },
};

export default async function AdminQrPage({ searchParams }: { searchParams: Promise<{ failed?: string }> }) {
  const { supabase } = await requireRole(["admin"], "/admin/qr");
  const sp = await searchParams;
  const failedOnly = sp.failed === "1";

  let attemptsQuery = supabase
    .from("scan_attempts")
    .select("id, result_code, created_at, qr_session_id, customer:profiles!scan_attempts_customer_id_fkey(id, full_name)")
    .order("created_at", { ascending: false })
    .limit(60);
  if (failedOnly) attemptsQuery = attemptsQuery.not("result_code", "like", "POINT_AWARDED%");

  const [{ data: sessions }, { data: attempts }, { data: settings }] = await Promise.all([
    supabase
      .from("qr_sessions")
      .select("id, issued_at, expires_at, revoked_at, revoke_reason, issuer:profiles!qr_sessions_issued_by_fkey(full_name)")
      .order("issued_at", { ascending: false })
      .limit(15),
    attemptsQuery,
    supabase.from("app_settings").select("business_timezone, qr_ttl_seconds").single(),
  ]);
  const tz = settings?.business_timezone ?? "Africa/Lagos";
  const now = currentTimeMs();
  const sessionRows = (sessions ?? []) as unknown as Array<{ id: string; issued_at: string; expires_at: string; revoked_at: string | null; revoke_reason: string | null; issuer: { full_name: string } | null }>;
  const attemptRows = (attempts ?? []) as unknown as Array<{ id: number; result_code: string; created_at: string; qr_session_id: string | null; customer: { id: string; full_name: string } | null }>;
  const active = sessionRows.filter((s) => !s.revoked_at && Date.parse(s.expires_at) > now);

  return (
    <>
      <PageHeader
        title="QR display"
        description={`Codes refresh automatically and each one is valid for ${settings?.qr_ttl_seconds ?? 60} seconds. Change the lifetime and business timezone in Settings.`}
        actions={
          <>
            <ButtonLink href="/display" variant="olive" icon="qr">
              Open full-screen display
            </ButtonLink>
            <ButtonLink href="/staff/check-in" variant="outline" icon="users">
              Staff-assisted check-in
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Panel title="Current status">
            <p className="text-sm text-muted">Live codes right now</p>
            <p className="type-heading tabular mt-1 text-4xl">{active.length}</p>
            <p className="mt-2 text-sm text-muted">
              {active.length === 0 ? "No display is showing a code. Open the display at the counter." : "Each open display shows its own code."}
            </p>
            <div className="mt-5 rounded-2xl bg-cream p-4">
              <p className="font-semibold">Revoke all live codes</p>
              <p className="mt-1 mb-3 text-sm text-muted">Use this if a code was shared outside the shop. Displays fetch a new code within seconds.</p>
              <ActionForm action={revokeQr}>
                <input name="reason" maxLength={280} placeholder="Reason (optional)" aria-label="Reason" className="h-11 w-full rounded-xl border border-line bg-surface px-3" />
                <SubmitButton variant="danger" size="sm" pendingLabel="Revoking...">
                  Revoke live codes
                </SubmitButton>
              </ActionForm>
            </div>
          </Panel>

          <Panel title="Recent codes">
            <ul className="divide-y divide-line text-sm">
              {sessionRows.length === 0 && <li className="py-3 text-muted">No codes issued yet.</li>}
              {sessionRows.map((s) => {
                const live = !s.revoked_at && Date.parse(s.expires_at) > now;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="tabular">
                        {formatTime(s.issued_at, tz)} to {formatTime(s.expires_at, tz)}
                      </p>
                      <p className="text-xs text-muted">{s.issuer?.full_name ?? "Unknown"}{s.revoke_reason ? `, ${s.revoke_reason}` : ""}</p>
                    </div>
                    {s.revoked_at ? <Badge tone="danger">Revoked</Badge> : live ? <Badge tone="olive">Live</Badge> : <Badge tone="muted">Expired</Badge>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <Panel
          title={failedOnly ? "Failed verification attempts" : "Scan activity"}
          action={
            <ButtonLink href={failedOnly ? "/admin/qr" : "/admin/qr?failed=1"} variant="outline" size="sm">
              {failedOnly ? "Show all scans" : "Show failed only"}
            </ButtonLink>
          }
        >
          <Table head={["When", "Customer", "Result"]} empty={failedOnly ? "No failed scans." : "No scans yet."}>
            {attemptRows.map((a) => {
              const meta = RESULT_LABELS[a.result_code] ?? { label: a.result_code, tone: "muted" as const };
              return (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(a.created_at, tz)}</Td>
                  <Td>
                    {a.customer ? (
                      <a href={`/admin/customers/${a.customer.id}`} className="font-semibold text-olive-deep hover:underline">
                        {a.customer.full_name}
                      </a>
                    ) : (
                      "Unknown"
                    )}
                  </Td>
                  <Td>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      </div>
    </>
  );
}
