"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { naira } from "@/lib/format";
import { ETA_CHOICES } from "@/lib/order/status";
import { searchCustomers, staffPlaceOrder } from "@/app/staff/actions";

type Item = { id: string; name: string; price: number; category: string; image: string | null };
type Customer = { id: string; full_name: string; phone: string | null };
type Fulfilment = "pickup" | "dine_in" | "delivery";

const FUL: { v: Fulfilment; label: string }[] = [
  { v: "dine_in", label: "Dine in" },
  { v: "pickup", label: "Pick up" },
  { v: "delivery", label: "Delivery" },
];

export function StaffOrderForm({ menu, deliveryFee }: { menu: Item[]; deliveryFee: number }) {
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [walkIn, setWalkIn] = useState("");
  const [find, setFind] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [ful, setFul] = useState<Fulfilment>("dine_in");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [paid, setPaid] = useState(false);
  const [eta, setEta] = useState<number>(15);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; total: number } | null>(null);

  const lines = menu.filter((m) => (qty[m.id] ?? 0) > 0);
  const subtotal = lines.reduce((s, l) => s + l.price * qty[l.id], 0);
  const fee = ful === "delivery" ? deliveryFee : 0;
  const shown = useMemo(() => {
    const f = find.trim().toLowerCase();
    return f ? menu.filter((m) => m.name.toLowerCase().includes(f)) : menu;
  }, [find, menu]);
  const groups = useMemo(() => {
    const g = new Map<string, Item[]>();
    for (const m of shown) g.set(m.category, [...(g.get(m.category) ?? []), m]);
    return [...g.entries()];
  }, [shown]);

  const change = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(50, (q[id] ?? 0) + d)) }));
  const who = customer ? customer.full_name : walkIn.trim();
  const canSend = Boolean(who) && lines.length > 0 && (ful !== "delivery" || (address.trim().length >= 5 && (contact.trim() || customer?.phone)));

  function search(v: string) {
    setQuery(v);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    start(async () => {
      const r = await searchCustomers(v.trim());
      if (r.ok) setResults((r.data ?? []).slice(0, 6));
    });
  }

  function send() {
    setError(null);
    start(async () => {
      const r = await staffPlaceOrder({
        customerId: customer?.id ?? null,
        walkInName: customer ? "" : walkIn.trim(),
        items: lines.map((l) => ({ id: l.id, qty: qty[l.id] })),
        fulfilment: ful,
        note,
        address,
        contact,
        paid,
        eta,
      });
      if (!r.ok) setError(r.error ?? "Couldn't place the order.");
      else setDone(r.data ?? null);
    });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-[var(--radius-card)] bg-surface p-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-peach text-olive-deep">
          <Icon name="check" className="size-8" />
        </span>
        <p className="type-heading mt-4 text-2xl">Order {done.reference} placed</p>
        <p className="mt-1 text-muted">
          {naira(done.total)} for {who}. You are in charge of it.
        </p>
        <div className="mt-6 grid gap-3">
          <Link href="/staff/orders?view=active" className="flex h-12 items-center justify-center rounded-full bg-ink font-semibold text-cream">
            Go to orders in progress
          </Link>
          <Button
            variant="ghost"
            size="lg"
            full
            onClick={() => {
              setDone(null);
              setQty({});
              setCustomer(null);
              setWalkIn("");
              setQuery("");
              setResults([]);
              setNote("");
              setAddress("");
              setContact("");
              setPaid(false);
            }}
          >
            Place another order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="space-y-6">
        <section className="rounded-[var(--radius-card)] bg-surface p-5">
          <h2 className="type-heading text-lg">1. Who is it for?</h2>
          {customer ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-sage-soft px-4 py-3">
              <div>
                <p className="font-semibold">{customer.full_name}</p>
                <p className="text-sm text-muted">{customer.phone ?? "No phone"}</p>
              </div>
              <button type="button" onClick={() => setCustomer(null)} className="text-sm font-semibold text-olive-deep underline">
                Change
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <input
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder="Search Palm Fren by name, phone or email"
                className="h-12 w-full rounded-2xl border border-line bg-cream px-4 outline-none focus:border-olive"
              />
              {results.length > 0 && (
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomer(c);
                          setResults([]);
                          if (c.phone) setContact(c.phone.replace(/^\+234/, "0"));
                        }}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-cream"
                      >
                        <span className="font-semibold">{c.full_name}</span>
                        <span className="text-sm text-muted">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-center text-sm text-muted">or, no account:</p>
              <input
                value={walkIn}
                onChange={(e) => setWalkIn(e.target.value.slice(0, 80))}
                placeholder="Walk in name, for example Ada at table 3"
                className="h-12 w-full rounded-2xl border border-line bg-cream px-4 outline-none focus:border-olive"
              />
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="type-heading text-lg">2. What are they having?</h2>
            <input
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Find an item"
              className="h-10 w-full rounded-full border border-line bg-cream px-4 text-sm outline-none focus:border-olive sm:w-56"
            />
          </div>
          <div className="mt-4 space-y-5">
            {groups.map(([cat, items]) => (
              <div key={cat}>
                <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">{cat}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {items.map((m) => {
                    const n = qty[m.id] ?? 0;
                    return (
                      <li key={m.id} className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 ${n ? "bg-sage-soft" : "bg-cream"}`}>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{m.name}</p>
                          <p className="text-sm text-muted tabular">{naira(m.price)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {n > 0 && (
                            <>
                              <button type="button" aria-label={`Remove one ${m.name}`} onClick={() => change(m.id, -1)} className="grid size-9 place-items-center rounded-full bg-surface">
                                <Icon name="minus" className="size-4" />
                              </button>
                              <span className="w-5 text-center font-bold tabular">{n}</span>
                            </>
                          )}
                          <button type="button" aria-label={`Add ${m.name}`} onClick={() => change(m.id, 1)} className="grid size-9 place-items-center rounded-full bg-olive-deep text-cream">
                            <Icon name="plus" className="size-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4 rounded-[var(--radius-card)] bg-surface p-5 lg:sticky lg:top-4">
        <h2 className="type-heading text-lg">3. Order details</h2>
        <div className="grid grid-cols-3 gap-2">
          {FUL.map((f) => (
            <button
              key={f.v}
              type="button"
              onClick={() => setFul(f.v)}
              className={`h-11 rounded-full text-sm font-semibold ${ful === f.v ? "bg-olive-deep text-cream" : "bg-sage-mist"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {ful === "delivery" && (
          <div className="space-y-2">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Delivery address"
              className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-sm outline-none focus:border-olive"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value.slice(0, 20))}
              inputMode="tel"
              placeholder="Phone for the rider"
              className="h-11 w-full rounded-2xl border border-line bg-cream px-4 text-sm outline-none focus:border-olive"
            />
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-semibold">Ready in</p>
          <div className="flex flex-wrap gap-1.5">
            {ETA_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setEta(m)}
                className={`h-9 rounded-full px-3 text-sm font-semibold ${eta === m ? "bg-olive-deep text-cream" : "bg-sage-mist"}`}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPaid(true)} className={`h-11 rounded-full text-sm font-semibold ${paid ? "bg-olive-deep text-cream" : "bg-sage-mist"}`}>
            Paid now
          </button>
          <button type="button" onClick={() => setPaid(false)} className={`h-11 rounded-full text-sm font-semibold ${!paid ? "bg-olive-deep text-cream" : "bg-sage-mist"}`}>
            Not paid yet
          </button>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          placeholder="Note (optional)"
          className="h-11 w-full rounded-2xl border border-line bg-cream px-4 text-sm outline-none focus:border-olive"
        />
        <div className="space-y-1 border-t border-line pt-3 text-sm">
          {lines.map((l) => (
            <p key={l.id} className="flex justify-between gap-3">
              <span>
                {qty[l.id]} x {l.name}
              </span>
              <span className="tabular">{naira(l.price * qty[l.id])}</span>
            </p>
          ))}
          {fee > 0 && (
            <p className="flex justify-between">
              <span>Delivery fee</span>
              <span className="tabular">{naira(fee)}</span>
            </p>
          )}
          <p className="flex justify-between pt-1 text-base font-semibold">
            <span>Total</span>
            <span className="tabular">{naira(subtotal + fee)}</span>
          </p>
        </div>
        <Button variant="dark" size="lg" full disabled={!canSend || pending} onClick={send}>
          {pending ? "Placing..." : "Place order"}
        </Button>
        {!canSend && <p className="text-center text-sm text-muted">Choose a customer or type a walk in name, and add items.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </aside>
    </div>
  );
}
