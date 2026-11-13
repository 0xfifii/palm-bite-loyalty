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

type MenuItem = { id: string; name: string; price: number; art: string; accent: string; image: string | null; merch: boolean };
type Placed = Extract<PlaceOrderResult, { ok: true }>;

export function OrderReview({ menu, address }: { menu: MenuItem[]; address: string }) {
  const cart = useSyncExternalStore(subscribeCart, cartSnapshot, cartServerSnapshot);
  const byId = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const lines = cart.filter((l) => byId.has(l.id)).map((l) => ({ ...byId.get(l.id)!, qty: l.qty }));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const hasMerch = lines.some((l) => l.merch);

  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await placeOrder({ items: lines.map((l) => ({ id: l.id, qty: l.qty })), fulfilment, note });
      if (!res.ok) {
        if (res.unavailable) setQty(res.unavailable, 0);
        setError(res.error);
        return;
      }
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
      <main className="flex min-h-[calc(100dvh-7rem)] flex-col px-5 pt-[calc(var(--safe-top)+1.5rem)]">
        <div className="flex flex-1 flex-col items-center text-center">
          <span className="animate-stamp-pop grid size-20 place-items-center rounded-full bg-peach text-olive-deep">
            <Icon name="check" className="size-10" />
          </span>
          <h1 className="type-heading mt-6 text-[1.8rem]">Almost done!</h1>
          <p className="mt-2 max-w-xs text-muted">Send your order to Palm Bite on WhatsApp so we can confirm it and start preparing.</p>
          <p className="type-display tabular mt-5 text-[2.2rem] text-olive-deep">{placed.reference}</p>

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

          <div className="mt-4 w-full">
            <Notice tone="info">
              {placed.paymentNote ?? "Pay when you collect, or by transfer once Palm Bite confirms your order on WhatsApp."}
            </Notice>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href={placed.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void copyMessage(placed.message)}
            className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#1F8A4C] text-base font-semibold text-white active:scale-[0.98]"
          >
            <Icon name="chat" className="size-5" /> Send order on WhatsApp
          </a>
          {!placed.prefilled && (
            <p className="text-center text-sm text-muted" aria-live="polite">
              {copied ? "Order copied. In WhatsApp, tap the message box, paste and send." : "We copy your order when you tap the button. Paste it in the chat and send."}
            </p>
          )}
          <Button variant="ghost" size="md" onClick={() => void copyMessage(placed.message)}>
            {copied ? "Copied" : "Copy order again"}
          </Button>
          <ButtonLink href="/home" variant="outline" size="lg" full>
            Back to home
          </ButtonLink>
        </div>
      </main>
    );
  }

  return (
    <main className="px-5 pt-[calc(var(--safe-top)+1.25rem)]">
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
            {fulfilment === "delivery" && <p className="mt-2 text-sm text-muted">Add your address below. Palm Bite will confirm delivery and any fee on WhatsApp.</p>}
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
              placeholder={fulfilment === "delivery" ? "Delivery address and phone" : "For example: less ice, extra syrup, pick up at 2pm"}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-olive focus:ring-4 focus:ring-olive/15"
            />
          </div>

          <div className="mt-5 rounded-[var(--radius-card)] bg-olive-deep p-5 text-cream">
            <p className="flex items-baseline justify-between">
              <span>Total</span>
              <span className="type-heading tabular text-2xl">{naira(total)}</span>
            </p>
            <p className="mt-1 text-xs text-cream/70">Final price is confirmed by Palm Bite.</p>
          </div>

          <div className="mt-5 mb-4">
            <Button variant="dark" size="lg" full trailingArrow onClick={submit} disabled={pending || (fulfilment === "delivery" && note.trim().length < 5)} aria-busy={pending}>
              {pending ? "Placing order..." : "Place order"}
            </Button>
            {fulfilment === "delivery" && note.trim().length < 5 && <p className="mt-2 text-center text-sm text-muted">Add your delivery address in the note.</p>}
          </div>
        </>
      )}
    </main>
  );
}
