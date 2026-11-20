"use client";

import { useState, useSyncExternalStore } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OrderStatusBadge, PaymentBadge } from "@/components/orders/OrderStatusBadge";
import { OrderTracker } from "@/components/orders/OrderTracker";
import { BankCard, GoAheadButton, ReceiptUpload } from "@/components/orders/PayAndSend";
import { NotifyButton } from "@/components/notify/NotifyButton";
import { EtaText } from "@/components/orders/EtaText";
import { naira } from "@/lib/format";
import { cartServerSnapshot, cartSnapshot, subscribeCart } from "@/lib/order/cart";
import { FULFILMENT_LABELS } from "@/lib/order/message";
import { OPEN_STATUSES } from "@/lib/order/status";
import type { BusinessSettings, Order } from "@/lib/types";

const STATUS_HELP: Record<Order["status"], string> = {
  new: "Sent to Palm Bite. Waiting for the team to confirm.",
  confirmed: "Confirmed by Palm Bite.",
  preparing: "We're preparing your order right now.",
  packaging: "Almost ready. We're packing it up.",
  ready: "Ready! Come to the counter.",
  on_the_way: "Your order is on its way to you.",
  completed: "Done. Enjoy, Palm Fren!",
  cancelled: "Cancelled by Palm Bite.",
};

export function OrdersList({
  orders,
  dates,
  business,
  userId,
}: {
  orders: Order[];
  dates: Record<string, string>;
  business: BusinessSettings;
  userId: string;
}) {
  const cart = useSyncExternalStore(subscribeCart, cartSnapshot, cartServerSnapshot);
  const basketCount = cart.reduce((s, l) => s + l.qty, 0);
  const [showBank, setShowBank] = useState<string | null>(null);
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status));
  const past = orders.filter((o) => !OPEN_STATUSES.includes(o.status));

  const card = (o: Order) => {
    const isOpen = OPEN_STATUSES.includes(o.status);
    return (
      <li key={o.id} className={`rounded-[var(--radius-card)] bg-surface p-5 ${o.status === "ready" || o.status === "on_the_way" ? "ring-2 ring-olive" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="type-heading tabular text-lg">{o.reference}</p>
            <p className="text-sm text-muted">
              {dates[o.id]}, {FULFILMENT_LABELS[o.fulfilment]}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <OrderStatusBadge status={o.status} fulfilment={o.fulfilment} />
            {o.status !== "cancelled" && <PaymentBadge status={o.payment_status} />}
          </div>
        </div>

        {isOpen && <OrderTracker status={o.status} fulfilment={o.fulfilment} />}

        <ul className="mt-4 space-y-1 text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>
                {i.qty} x {i.name}
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
        {o.fulfilment === "delivery" && o.delivery_address && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
            <Icon name="pin" className="mt-0.5 size-4 shrink-0" /> {o.delivery_address}
            {o.contact_phone ? `, ${o.contact_phone}` : ""}
          </p>
        )}
        <p className="mt-2 text-sm font-medium text-olive-deep">{STATUS_HELP[o.status]}</p>
        {isOpen && o.eta_at && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-peach/50 px-3 py-2 text-sm font-semibold text-olive-night">
            <Icon name="clock" className="size-4" /> <EtaText at={o.eta_at} minutes={o.eta_minutes} />
          </p>
        )}
        {o.status === "cancelled" && o.cancel_reason && <p className="mt-1 text-sm text-danger">Reason: {o.cancel_reason}</p>}
        {o.accepted_by_name && o.status !== "cancelled" && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Icon name="user" className="size-4" /> Accepted by {o.accepted_by_name}
          </p>
        )}

        {isOpen && (
          <div className="mt-4 space-y-3">
            {o.payment_status !== "paid" &&
              (showBank === o.id ? (
                <BankCard business={business} total={o.total_naira} />
              ) : (
                <button type="button" onClick={() => setShowBank(o.id)} className="flex items-center gap-2 text-sm font-semibold text-olive-deep underline underline-offset-4">
                  <Icon name="bank" className="size-4" /> Show bank details
                </button>
              ))}
            <ReceiptUpload orderId={o.id} userId={userId} status={o.payment_status} />
            {(o.status === "new" || o.status === "confirmed") && <GoAheadButton orderId={o.id} sentAt={o.go_ahead_at} />}

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
        {open.length > 0 && <NotifyButton label="Get notified when your order moves" />}
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
              <ul className="mt-3 grid gap-3 md:grid-cols-2">{open.map(card)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-8" aria-labelledby="past-orders">
              <h2 id="past-orders" className="type-heading text-xl">
                Past orders
              </h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">{past.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
