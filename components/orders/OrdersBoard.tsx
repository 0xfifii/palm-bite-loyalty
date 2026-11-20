import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, naira } from "@/lib/format";
import { FULFILMENT_LABELS } from "@/lib/order/message";
import { OPEN_STATUSES } from "@/lib/order/status";
import { Icon } from "@/components/ui/Icon";
import { NotifyButton } from "@/components/notify/NotifyButton";
import { OrderActions } from "./OrderActions";
import { OrderStatusBadge, PaymentBadge } from "./OrderStatusBadge";
import { EtaText, SinceText } from "./EtaText";
import type { Order } from "@/lib/types";

type Row = Order & { customer: { id: string; full_name: string; phone: string | null } | null };
export type BoardView = "new" | "active" | "history";
export type HistoryFilter = "all" | "mine" | "cancelled";

const telHref = (p: string) => `tel:${p.replace(/[^0-9+]/g, "")}`;
const ACTIVE = OPEN_STATUSES.filter((s) => s !== "new");

/** Orders for staff and admins (RLS): New, In progress and History. */
export async function OrdersBoard({
  base,
  view,
  filter,
  customerLinks,
}: {
  base: string;
  view: BoardView;
  filter: HistoryFilter;
  customerLinks: boolean;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const meId = String(claims?.claims?.sub ?? "");
  const { data: isAdmin } = await supabase.rpc("is_admin");

  let q = supabase.from("orders").select("*, customer:profiles!orders_customer_id_fkey(id, full_name, phone)");
  if (view === "new") q = q.eq("status", "new").order("created_at", { ascending: true });
  else if (view === "active") q = q.in("status", ACTIVE).order("created_at", { ascending: true });
  else {
    q = filter === "cancelled" ? q.eq("status", "cancelled") : q.in("status", ["completed", "cancelled"]);
    if (filter === "mine") q = q.eq("accepted_by", meId);
    q = q.order("status_changed_at", { ascending: false });
  }

  const count = (statuses: string[]) => supabase.from("orders").select("id", { count: "exact", head: true }).in("status", statuses);
  const [{ data }, { data: settings }, newCount, activeCount, mineActive] = await Promise.all([
    q.limit(view === "history" ? 60 : 80),
    supabase.from("app_settings").select("business_timezone").single(),
    count(["new"]),
    count(ACTIVE),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ACTIVE).eq("accepted_by", meId),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const tz = settings?.business_timezone ?? "Africa/Lagos";

  const receiptPaths = rows.map((r) => r.receipt_path).filter((p): p is string => Boolean(p));
  const receiptUrls = new Map<string, string>();
  if (receiptPaths.length) {
    const { data: signed } = await supabase.storage.from("order-receipts").createSignedUrls(receiptPaths, 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) receiptUrls.set(s.path, s.signedUrl);
  }

  const tab = (v: BoardView, label: string, n?: number | null) => (
    <Link
      href={`${base}${v === "new" ? "" : `?view=${v}`}`}
      aria-current={view === v ? "page" : undefined}
      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${view === v ? "bg-olive-deep text-cream" : "text-muted hover:text-ink"}`}
    >
      {label}
      {typeof n === "number" && n > 0 && (
        <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs ${v === "new" ? "bg-peach text-olive-night" : view === v ? "bg-cream/20" : "bg-sage-mist"}`}>{n}</span>
      )}
    </Link>
  );
  const chip = (f: HistoryFilter, label: string) => (
    <Link
      href={`${base}?view=history${f === "all" ? "" : `&filter=${f}`}`}
      className={`rounded-full px-3.5 py-2 text-sm font-semibold ${filter === f ? "bg-ink text-cream" : "bg-surface text-muted"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-full bg-surface p-1" aria-label="Order lists">
          {tab("new", "New", newCount.count)}
          {tab("active", "In progress", activeCount.count)}
          {tab("history", "History")}
        </nav>
        {(mineActive.count ?? 0) > 0 && (
          <p className="rounded-full bg-sage-soft px-3 py-1.5 text-sm font-semibold text-olive-night">You are in charge of {mineActive.count}</p>
        )}
      </div>

      {view === "history" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {chip("all", "All finished")}
          {chip("mine", "Handled by me")}
          {chip("cancelled", "Cancelled")}
        </div>
      )}

      {view === "new" && (
        <div className="mb-4 max-w-sm space-y-2">
          <NotifyButton label="Notify this phone about new orders" tone="dark" />
          <Link href="/notifications" className="inline-block text-sm font-semibold text-olive-deep underline underline-offset-4">
            Not getting notifications? Check this phone
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-surface p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-sage-soft text-olive-deep">
            <Icon name="bag" className="size-7" />
          </span>
          <p className="type-heading mt-3 text-lg">
            {view === "new" ? "No new orders right now" : view === "active" ? "Nothing in progress" : filter === "mine" ? "You haven't finished any orders yet" : "No finished orders yet"}
          </p>
          <p className="mt-1 text-sm text-muted">{view === "new" ? "New orders appear here with a sound." : "Orders show here as they move along."}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((o) => {
            const receipt = o.receipt_path ? receiptUrls.get(o.receipt_path) : undefined;
            const phone = o.contact_phone ?? o.customer?.phone ?? null;
            const mine = o.accepted_by === meId;
            const open = OPEN_STATUSES.includes(o.status);
            const who = o.customer?.full_name ?? o.walk_in_name ?? "Palm Fren";
            return (
              <li
                key={o.id}
                className={`rounded-[var(--radius-card)] bg-surface p-5 transition-shadow ${o.status === "new" ? "ring-2 ring-peach" : mine && open ? "ring-2 ring-olive" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="type-heading tabular text-xl">{o.reference}</p>
                    <p className="text-sm text-muted">
                      {open ? <SinceText at={o.created_at} /> : formatDateTime(o.status_changed_at, tz)}
                      {o.placed_by && " · placed by staff"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
                    {o.status !== "cancelled" && <PaymentBadge status={o.payment_status} />}
                  </div>
                </div>

                {o.accepted_by_name && (
                  <p className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${mine ? "bg-olive-deep text-cream" : "bg-sage-mist"}`}>
                    <Icon name="user" className="size-4" /> {mine ? "You are in charge" : `${o.accepted_by_name} is in charge`}
                  </p>
                )}
                {open && o.eta_at && (
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-olive-deep">
                    <Icon name="clock" className="size-4" /> <EtaText at={o.eta_at} minutes={o.eta_minutes} staff />
                  </p>
                )}
                {o.go_ahead_at && open && (
                  <p className="mt-2 flex items-center gap-2 rounded-xl bg-peach px-3 py-2 text-sm font-semibold text-olive-night">
                    <Icon name="flame" className="size-4" /> Customer said go ahead, {formatDateTime(o.go_ahead_at, tz)}
                  </p>
                )}
                {o.status === "cancelled" && o.cancel_reason && <p className="mt-2 text-sm font-semibold text-danger">Cancelled: {o.cancel_reason}</p>}

                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {o.customer && customerLinks ? (
                      <Link href={`/admin/customers/${o.customer.id}`} className="text-olive-deep hover:underline">
                        {who}
                      </Link>
                    ) : (
                      who
                    )}
                    {!o.customer && o.walk_in_name && <span className="ml-1 text-sm font-normal text-muted">(walk in)</span>}
                  </p>
                  <p className="text-sm text-muted">{FULFILMENT_LABELS[o.fulfilment]}</p>
                </div>
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
                        <span className="font-semibold">{i.qty} x</span> {i.name}
                      </span>
                      <span className="tabular">{naira(i.line_total)}</span>
                    </li>
                  ))}
                </ul>
                {o.delivery_fee_naira > 0 && (
                  <p className="mt-1 flex justify-between text-sm">
                    <span>Delivery fee</span>
                    <span className="tabular">{naira(o.delivery_fee_naira)}</span>
                  </p>
                )}
                <p className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular">{naira(o.total_naira)}</span>
                </p>
                {o.note && <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-sm">Note: {o.note}</p>}
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
                  <OrderActions order={o} meId={meId} isAdmin={Boolean(isAdmin)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
