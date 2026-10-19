import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { Badge, RewardStatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { CustomerRow } from "@/app/staff/actions";
import { formatDate } from "@/lib/format";
import type { RewardStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Customers" };

const PAGE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { supabase } = await requireRole(["admin"], "/admin/customers");
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.rpc("admin_search_customers", { p_query: q, p_limit: PAGE, p_offset: (page - 1) * PAGE }),
    supabase.from("app_settings").select("business_timezone").single(),
  ]);
  const rows = (data ?? []) as CustomerRow[];
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const tz = settings?.business_timezone ?? "Africa/Lagos";
  const link = (p: number) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Customers" description="Search by name, phone number or email." />
      <Panel>
        <form className="relative mb-5" role="search">
          <Icon name="search" className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <label htmlFor="q" className="sr-only">
            Search customers
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search customers"
            className="h-12 w-full rounded-2xl border border-line bg-cream pr-4 pl-12 outline-none focus:border-olive focus:ring-4 focus:ring-olive/15"
          />
        </form>
        <p className="mb-3 text-sm text-muted">
          {total} {total === 1 ? "account" : "accounts"}
          {q ? ` matching "${q}"` : ""}
        </p>
        <Table head={["Name", "Phone", "Points", "Card", "Visits", "Reward", "Last visit", "Status"]} empty="No customers match this search.">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-sage-mist/50">
              <Td>
                <Link href={`/admin/customers/${r.id}`} className="font-semibold text-olive-deep underline-offset-4 hover:underline">
                  {r.full_name}
                </Link>
                <p className="text-xs text-muted">{r.email}</p>
              </Td>
              <Td className="tabular">{r.phone ?? ""}</Td>
              <Td className="tabular font-semibold">{r.current_points} / 15</Td>
              <Td className="tabular">{r.cycle_number}</Td>
              <Td className="tabular">{r.total_visits}</Td>
              <Td>{r.open_reward_status ? <RewardStatusBadge status={r.open_reward_status as RewardStatus} /> : null}</Td>
              <Td className="whitespace-nowrap text-muted">{r.last_visit_at ? formatDate(r.last_visit_at, tz) : "Never"}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {r.status === "suspended" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="sage">Active</Badge>}
                  {r.role !== "customer" && <Badge tone="olive">{r.role === "admin" ? "Admin" : "Staff"}</Badge>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
        {pages > 1 && (
          <nav className="mt-5 flex items-center justify-between text-sm" aria-label="Pagination">
            {page > 1 ? (
              <Link href={link(page - 1)} className="font-semibold text-olive-deep">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={link(page + 1)} className="font-semibold text-olive-deep">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Panel>
    </>
  );
}
