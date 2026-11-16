"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { naira } from "@/lib/format";
import { cartServerSnapshot, cartSnapshot, subscribeCart } from "@/lib/order/cart";
import { FULFILMENT_LABELS, orderMessage, whatsappUrl } from "@/lib/order/message";
import type { BusinessSettings, Order } from "@/lib/types";
import { cancelMyOrder } from "../order/actions";

const STATUS_HELP: Record<Order["status"], string> = {
  new: "Waiting for Palm Bite to confirm on WhatsApp.",
  confirmed: "Confirmed. We're preparing it.",
  ready: "Ready for you!",
  completed: "Completed. Enjoy!",
  cancelled: "Cancelled.",
};

export function OrdersList({
  orders,
  dates,
  business,
  name,
  phone,
}: {
  orders: Order[];
  dates: Record<string, string>;
  business: BusinessSettings;
  name: string;
  phone: string | null;
}) {
  const router = useRouter();
  const cart = useSyncExternalStore(subscribeCart, cartSnapshot, cartServerSnapshot);
  const basketCount = cart.reduce((s, l) => s + l.qty, 0);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const open = orders.filter((o) => ["new", "confirmed", "ready"].includes(o.status));
  const past = orders.filter((o) => !["new", "confirmed", "ready"].includes(o.status));

  async function resend(o: Order) {
    const text = orderMessage({ reference: o.reference, name, phone, items: o.items, total: o.total_naira, fulfilment: o.fulfilment, note: o.note });
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Order copied. Paste it in the WhatsApp chat and send.");
    } catch {
      setNotice(null);
    }
  }

  const card = (o: Order) => {
    const { url, prefilled } = whatsappUrl(business, orderMessage({ reference: o.reference, name, phone, items: o.items, total: o.total_naira, fulfilment: o.fulfilment, note: o.note }));
    return (
      <li key={o.id} className={`rounded-[var(--radius-card)] bg-surface p-5 ${o.status === "ready" ? "ring-2 ring-olive" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="type-heading tabular text-lg">{o.reference}</p>
            <p className="text-sm text-muted">
              {dates[o.id]}, {FULFILMENT_LABELS[o.fulfilment]}
            </p>
          </div>
          <OrderStatusBadge status={o.status} />
        </div>
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
        <p className="mt-2 text-sm text-muted">{STATUS_HELP[o.status]}</p>
        {o.status === "new" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => !prefilled && void resend(o)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1F8A4C] px-4 text-sm font-semibold text-white"
            >
              <Icon name="chat" className="size-4" /> Send on WhatsApp
            </a>
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await cancelMyOrder(o.id);
                  setNotice(res.ok ? `Order ${o.reference} cancelled.` : (res.error ?? "Couldn't cancel."));
                  if (res.ok) router.refresh();
                })
              }
              className="h-10 rounded-full px-4 text-sm font-semibold text-danger hover:bg-danger-soft"
            >
              Cancel
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="mt-6 grid gap-3">
        {basketCount > 0 && (
          <ButtonLink href="/order" variant="peach" size="lg" icon="bag" trailingArrow full>
            Continue your order ({basketCount} {basketCount === 1 ? "item" : "items"})
          </ButtonLink>
        )}
        <ButtonLink href="/menu" variant="dark" size="lg" icon="plus" trailingArrow full>
          Place a new order
        </ButtonLink>
      </div>

      <div className="mt-4" aria-live="polite">
        {notice && <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm text-olive-night">{notice}</p>}
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] bg-surface p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-sage-soft text-olive-deep">
            <Icon name="bag" className="size-7" />
          </span>
          <p className="type-heading mt-4 text-lg">No orders yet</p>
          <p className="mt-1 text-sm text-muted">Your orders and their status will show here.</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section className="mt-6" aria-labelledby="open-orders">
              <h2 id="open-orders" className="type-heading text-xl">
                In progress
              </h2>
              <ul className="mt-3 space-y-3">{open.map(card)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-8" aria-labelledby="past-orders">
              <h2 id="past-orders" className="type-heading text-xl">
                Past orders
              </h2>
              <ul className="mt-3 space-y-3">{past.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
