"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Field";
import { naira } from "@/lib/format";
import { cartServerSnapshot, cartSnapshot, clearCart, setQty, subscribeCart } from "@/lib/order/cart";
import { FULFILMENT_LABELS, type Fulfilment } from "@/lib/order/message";
import { placeOrder, type PlaceOrderResult } from "./actions";
import { BankCard, GoAheadButton, ReceiptUpload } from "@/components/orders/PayAndSend";
import { NotifyButton } from "@/components/notify/NotifyButton";
import type { BusinessSettings } from "@/lib/types";

type MenuItem = { id: string; name: string; price: number; art: string; accent: string; image: string | null; merch: boolean };
type Placed = Extract<PlaceOrderResult, { ok: true }>;

export function OrderReview({
  menu,
  address,
  business,
  userId,
  phone,
}: {
  menu: MenuItem[];
  address: string;
  business: BusinessSettings;
  userId: string;
  phone: string | null;
}) {
  const cart = useSyncExternalStore(subscribeCart, cartSnapshot, cartServerSnapshot);
  const byId = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const lines = cart.filter((l) => byId.has(l.id)).map((l) => ({ ...byId.get(l.id)!, qty: l.qty }));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const hasMerch = lines.some((l) => l.merch);

  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [note, setNote] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [contact, setContact] = useState(phone ? phone.replace(/^\+234/, "0") : "");
  const [fieldError, setFieldError] = useState<"address" | "contact" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await placeOrder({ items: lines.map((l) => ({ id: l.id, qty: l.qty })), fulfilment, note, address: deliverTo, contact });
      if (!res.ok) {
        if (res.unavailable) setQty(res.unavailable, 0);
        setFieldError(res.field ?? null);
        setError(res.error);
        return;
      }
      setFieldError(null);
      setPlaced(res);
      clearCart();
    });
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (placed) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 pt-[calc(var(--safe-top)+1.5rem)] pb-6">
        <div className="flex flex-col items-center text-center">
          <span className="animate-stamp-pop grid size-20 place-items-center rounded-full bg-peach text-olive-deep">
            <Icon name="check" className="size-10" />
          </span>
          <h1 className="type-heading mt-6 text-[1.8rem]">Order sent to Palm Bite!</h1>
          <p className="mt-2 max-w-xs text-muted">The team has been notified. Follow every step on your Orders tab.</p>
          <p className="type-display tabular mt-5 text-[2.2rem] text-olive-deep">{placed.reference}</p>
        </div>

        <div className="mt-5 w-full rounded-[var(--radius-card)] bg-surface p-4 text-left">
          <ul className="space-y-1.5 text-sm">
            {placed.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.qty} x {i.name}
                </span>
                <span className="tabular">{naira(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-line pt-3 font-semibold">
            <span>Total</span>
            <span className="tabular">{naira(placed.total)}</span>
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <BankCard business={business} total={placed.total} />
          <ReceiptUpload orderId={placed.orderId} userId={userId} status="unpaid" />
          <GoAheadButton orderId={placed.orderId} sentAt={null} />
          <NotifyButton label="Get notified when your order moves" />
          {placed.paymentNote && <Notice tone="info">{placed.paymentNote}</Notice>}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <ButtonLink href="/orders" variant="dark" size="lg" full trailingArrow>
            Track my order
          </ButtonLink>
          <a
            href={placed.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => !placed.prefilled && void copyMessage(placed.message)}
            className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-[#1F8A4C] text-sm font-semibold text-[#1F8A4C] active:scale-[0.98]"
          >
            <Icon name="chat" className="size-4" /> Also message us on WhatsApp
          </a>
          {copied && !placed.prefilled && <p className="text-center text-sm text-muted">Order copied. Paste it in the chat and send.</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-[calc(var(--safe-top)+1.25rem)]">
      <header className="flex items-center justify-between">
        <Link href="/menu" aria-label="Back to menu" className="grid size-11 place-items-center rounded-full bg-surface shadow-soft">
          <Icon name="back" />
        </Link>
        <h1 className="type-heading text-lg">Your order</h1>
        <span className="size-11" />
      </header>

      {lines.length === 0 ? (
        <div className="mt-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-sage-soft text-olive-deep">
            <Icon name="bag" className="size-8" />
          </span>
          <p className="type-heading mt-5 text-xl">Your order is empty</p>
          <p className="mt-1 text-muted">Add something from the menu to get started.</p>
          <div className="mt-6">
            <ButtonLink href="/menu" variant="dark" size="lg">
              See the menu
            </ButtonLink>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="mt-4">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <ul className="mt-5 space-y-2">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3">
                <div className="h-16 w-12 shrink-0">
                  <DrinkImage name="" imageUrl={l.image} accent={l.accent} art={l.art} id={`o-${l.id}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.name}</p>
                  <p className="tabular text-sm text-muted">{naira(l.price)} each</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-sage-mist p-1">
                  <button onClick={() => setQty(l.id, l.qty - 1)} aria-label={`Remove one ${l.name}`} className="grid size-8 place-items-center rounded-full bg-surface">
                    <Icon name="minus" className="size-4" />
                  </button>
                  <span className="tabular w-5 text-center text-sm font-bold">{l.qty}</span>
                  <button onClick={() => setQty(l.id, l.qty + 1)} aria-label={`Add one more ${l.name}`} className="grid size-8 place-items-center rounded-full bg-ink text-cream">
                    <Icon name="plus" className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">How would you like it?</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FULFILMENT_LABELS) as Fulfilment[]).map((f) => (
                <label
                  key={f}
                  className={`cursor-pointer rounded-2xl border-2 px-2 py-3 text-center text-sm font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-olive/20 ${
                    fulfilment === f ? "border-olive-deep bg-sage-mist" : "border-line bg-surface"
                  }`}
                >
                  <input type="radio" name="fulfilment" value={f} checked={fulfilment === f} onChange={() => setFulfilment(f)} className="sr-only" />
                  {FULFILMENT_LABELS[f]}
                </label>
              ))}
            </div>
            {fulfilment === "delivery" && (
              <div className="mt-4 space-y-4 rounded-[var(--radius-card)] bg-surface p-4">
                <div>
                  <label htmlFor="deliver-to" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Icon name="pin" className="size-4" /> Delivery address
                  </label>
                  <textarea
                    id="deliver-to"
                    value={deliverTo}
                    onChange={(e) => setDeliverTo(e.target.value.slice(0, 300))}
                    rows={2}
                    required
                    autoComplete="street-address"
                    placeholder="House number, street, area and a landmark"
                    aria-invalid={fieldError === "address" || undefined}
                    className={`w-full rounded-2xl border bg-cream px-4 py-3 outline-none focus:border-olive focus:ring-4 focus:ring-olive/15 ${fieldError === "address" ? "border-danger" : "border-line"}`}
                  />
                </div>
                <div>
                  <label htmlFor="contact" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Icon name="phone" className="size-4" /> Phone number for the rider
                  </label>
                  <input
                    id="contact"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={contact}
                    onChange={(e) => setContact(e.target.value.slice(0, 20))}
                    placeholder="0803 123 4567"
                    aria-invalid={fieldError === "contact" || undefined}
                    className={`h-12 w-full rounded-2xl border bg-cream px-4 outline-none focus:border-olive focus:ring-4 focus:ring-olive/15 ${fieldError === "contact" ? "border-danger" : "border-line"}`}
                  />
                </div>
                <p className="text-sm text-muted">Palm Bite will confirm the delivery fee with you.</p>
              </div>
            )}
            {hasMerch && <p className="mt-2 text-sm text-muted">Merch is collected in store at {address}.</p>}
          </fieldset>

          <div className="mt-5">
            <label htmlFor="order-note" className="mb-1.5 block text-sm font-semibold">
              Note for Palm Bite (optional)
            </label>
            <textarea
              id="order-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="For example: less ice, extra syrup, pick up at 2pm"
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-olive focus:ring-4 focus:ring-olive/15"
            />
          </div>

          <div className="mt-5 rounded-[var(--radius-card)] bg-olive-deep p-5 text-cream">
            <p className="flex items-baseline justify-between">
              <span>Total</span>
              <span className="type-heading tabular text-2xl">{naira(total)}</span>
            </p>
            <p className="mt-1 text-xs text-cream/70">Pay by transfer to {business.bank_name}, {business.bank_account_number} ({business.bank_account_name}). You can upload the receipt after placing your order.</p>
          </div>

          <div className="mt-5 mb-4">
            <Button
              variant="dark"
              size="lg"
              full
              trailingArrow
              onClick={submit}
              disabled={pending || (fulfilment === "delivery" && (deliverTo.trim().length < 5 || contact.replace(/[^0-9]/g, "").length < 7))}
              aria-busy={pending}
            >
              {pending ? "Sending to Palm Bite..." : "Send order to Palm Bite"}
            </Button>
            {fulfilment === "delivery" && (deliverTo.trim().length < 5 || contact.replace(/[^0-9]/g, "").length < 7) && (
              <p className="mt-2 text-center text-sm text-muted">Add your delivery address and phone number to continue.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
