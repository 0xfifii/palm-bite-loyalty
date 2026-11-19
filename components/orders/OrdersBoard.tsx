import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, naira } from "@/lib/format";
import { FULFILMENT_LABELS } from "@/lib/order/message";
import { OPEN_STATUSES } from "@/lib/order/status";
import { Icon } from "@/components/ui/Icon";
import { NotifyButton } from "@/components/notify/NotifyButton";
import { NewOrderAlert, OrderActions } from "./OrderActions";
import { OrderStatusBadge, PaymentBadge } from "./OrderStatusBadge";
import type { Order } from "@/lib/types";

type Row = Order & { customer: { id: string; full_name: string; phone: string | null } | null };

const telHref = (p: string) => `tel:${p.replace(/[^0-9+]/g, "")}`;

/** Orders placed in the app. Staff and admins only (RLS). */
export async function OrdersBoard({ show, customerLinks }: { show: "open" | "done"; customerLinks: boolean }) {
  const supabase = await createClient();
  const statuses = show === "open" ? OPEN_STATUSES : ["completed", "cancelled"];
  const [{ data }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customer:profiles!orders_customer_id_fkey(id, full_name, phone)")
      .in("status", statuses)
      .order("created_at", { ascending: show === "open" })
      .limit(80),
    supabase.from("app_settings").select("business_timezone").single(),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const tz = settings?.business_timezone ?? "Africa/Lagos";

  // Short-lived private links to view receipts.
  const receiptPaths = rows.map((r) => r.receipt_path).filter((p): p is string => Boolean(p));
  const receiptUrls = new Map<string, string>();
  if (receiptPaths.length) {
    const { data: signed } = await supabase.storage.from("order-receipts").createSignedUrls(receiptPaths, 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) receiptUrls.set(s.path, s.signedUrl);
  }

  const signal = rows.map((r) => `${r.id}:${r.status}:${r.payment_status}:${r.go_ahead_at ?? ""}`).join("|");
  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <>
      {show === "open" && (
        <>
          <NewOrderAlert signal={signal} newCount={newCount} />
          <div className="mb-4 max-w-sm">
            <NotifyButton label="Notify this phone about new orders" tone="dark" />
          </div>
        </>
      )}
      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-card)] bg-surface p-5 text-muted">
          {show === "open" ? "No open orders. New orders from the app appear here." : "No finished orders yet."}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((o) => {
            const receipt = o.receipt_path ? receiptUrls.get(o.receipt_path) : undefined;
            const phone = o.contact_phone ?? o.customer?.phone ?? null;
            return (
              <li key={o.id} className={`rounded-[var(--radius-card)] bg-surface p-5 ${o.status === "new" ? "ring-2 ring-peach" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="type-heading tabular text-lg">{o.reference}</p>
                    <p className="text-sm text-muted">{formatDateTime(o.created_at, tz)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
                    {o.status !== "cancelled" && <PaymentBadge status={o.payment_status} />}
                  </div>
                </div>

                {o.go_ahead_at && OPEN_STATUSES.includes(o.status) && (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-peach px-3 py-2 text-sm font-semibold text-olive-night">
                    <Icon name="flame" className="size-4" /> Customer said go ahead, {formatDateTime(o.go_ahead_at, tz)}
                  </p>
                )}

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
                </p>
                <p className="text-sm text-muted">{FULFILMENT_LABELS[o.fulfilment]}</p>
                {phone && (
                  <a href={telHref(phone)} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-olive-deep underline underline-offset-4">
                    <Icon name="phone" className="size-4" /> Call {phone}
                  </a>
                )}
                {o.fulfilment === "delivery" && o.delivery_address && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-sage-mist px-3 py-2 text-sm">
                    <Icon name="pin" className="mt-0.5 size-4 shrink-0" /> {o.delivery_address}
                  </p>
                )}

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
                {receipt && (
                  <a
                    href={receipt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-peach px-4 py-2 text-sm font-semibold text-olive-night"
                  >
                    <Icon name="receipt" className="size-4" /> View payment receipt
                  </a>
                )}
                <div className="mt-4">
                  <OrderActions order={o} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
