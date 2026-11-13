import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, naira } from "@/lib/format";
import { FULFILMENT_LABELS } from "@/lib/order/message";
import { OrderActions } from "./OrderActions";
import { OrderStatusBadge } from "./OrderStatusBadge";
import type { Order } from "@/lib/types";

type Row = Order & { customer: { id: string; full_name: string; phone: string | null } | null };

/** Orders placed in the app, newest first. Staff and admins only (RLS). */
export async function OrdersBoard({ show, customerLinks }: { show: "open" | "done"; customerLinks: boolean }) {
  const supabase = await createClient();
  const statuses = show === "open" ? ["new", "confirmed", "ready"] : ["completed", "cancelled"];
  const [{ data }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customer:profiles!orders_customer_id_fkey(id, full_name, phone)")
      .in("status", statuses)
      .order("created_at", { ascending: show === "open" })
      .limit(60),
    supabase.from("app_settings").select("business_timezone").single(),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const tz = settings?.business_timezone ?? "Africa/Lagos";

  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] bg-surface p-5 text-muted">
        {show === "open" ? "No open orders. New orders from the app appear here." : "No finished orders yet."}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((o) => (
        <li key={o.id} className={`rounded-[var(--radius-card)] bg-surface p-5 ${o.status === "new" ? "ring-2 ring-peach" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-heading tabular text-lg">{o.reference}</p>
              <p className="text-sm text-muted">{formatDateTime(o.created_at, tz)}</p>
            </div>
            <OrderStatusBadge status={o.status} />
          </div>
          <p className="mt-3 font-semibold">
            {o.customer ? (
              customerLinks ? (
                <Link href={`/admin/customers/${o.customer.id}`} className="text-olive-deep hover:underline">
                  {o.customer.full_name}
                </Link>
              ) : (
                o.customer.full_name
              )
            ) : (
              "Palm Fren"
            )}
            {o.customer?.phone && <span className="tabular ml-2 text-sm font-normal text-muted">{o.customer.phone}</span>}
          </p>
          <p className="text-sm text-muted">{FULFILMENT_LABELS[o.fulfilment]}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.qty} x {i.name}
                </span>
                <span className="tabular">{naira(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular">{naira(o.total_naira)}</span>
          </p>
          {o.note && <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-sm">{o.note}</p>}
          <div className="mt-4">
            <OrderActions id={o.id} status={o.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
