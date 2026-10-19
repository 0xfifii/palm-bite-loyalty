import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { Metric } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { REPORT_KINDS, summarize, type ReportKind } from "@/lib/reports/csv";
import { fetchReport, parseReportParams } from "@/lib/reports/fetch";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ kind?: string; from?: string; to?: string }> }) {
  await requireRole(["admin"], "/admin/reports");
  const sp = await searchParams;
  const params = parseReportParams(sp.kind ?? "daily_visits", sp.from, sp.to) ?? { kind: "daily_visits" as ReportKind, from: null, to: null };
  const meta = REPORT_KINDS[params.kind];

  let rows: Array<Record<string, unknown>> = [];
  let failed = false;
  try {
    rows = await fetchReport(params.kind, params.from, params.to);
  } catch {
    failed = true;
  }
  const summary = summarize(params.kind, rows);
  const preview = rows.slice(0, 25);
  const columns = preview.length ? Object.keys(preview[0]) : [];
  const qs = new URLSearchParams({ ...(params.from ? { from: params.from } : {}), ...(params.to ? { to: params.to } : {}) }).toString();
  const downloadHref = `/api/reports/${params.kind}${qs ? `?${qs}` : ""}`;

  return (
    <>
      <PageHeader title="Reports" description="Live figures from the database. Every export is recorded in the audit log." />

      <Panel>
        <form className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="kind" className="mb-1.5 block text-sm font-medium">
              Report
            </label>
            <select id="kind" name="kind" defaultValue={params.kind} className="h-12 w-full rounded-xl border border-line bg-surface px-3">
              {Object.entries(REPORT_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className="mb-1.5 block text-sm font-medium">
              From
            </label>
            <input id="from" name="from" type="date" defaultValue={params.from ?? ""} disabled={!meta.dated} className="h-12 w-full rounded-xl border border-line px-3 disabled:opacity-50" />
          </div>
          <div>
            <label htmlFor="to" className="mb-1.5 block text-sm font-medium">
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={params.to ?? ""} disabled={!meta.dated} className="h-12 w-full rounded-xl border border-line px-3 disabled:opacity-50" />
          </div>
          <button className="h-12 rounded-full bg-ink px-6 font-semibold text-cream">Run report</button>
        </form>
        {!meta.dated && <p className="mt-3 text-sm text-muted">This report shows the current state, so dates do not apply.</p>}
      </Panel>

      {failed ? (
        <Panel className="mt-6">
          <p className="text-danger">The report could not be generated. Please try again.</p>
        </Panel>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summary.map((s, i) => (
              <Metric key={s.label} label={s.label} value={s.value} emphasis={i === 0} />
            ))}
          </div>

          <Panel
            className="mt-6"
            title={`${meta.label}${rows.length > preview.length ? `, first ${preview.length} of ${rows.length} rows` : ""}`}
            action={
              <a href={downloadHref} className="inline-flex h-10 items-center gap-2 rounded-full bg-olive-deep px-4 text-sm font-semibold text-cream" download>
                <Icon name="download" className="size-4" /> Download CSV
              </a>
            }
          >
            <Table head={columns.map((c) => c.replace(/_/g, " "))} empty="No records for this period.">
              {preview.map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <Td key={c} className="whitespace-nowrap">
                      {r[c] === null || r[c] === undefined ? "" : typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c])}
                    </Td>
                  ))}
                </tr>
              ))}
            </Table>
          </Panel>
        </>
      )}
    </>
  );
}
