"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { naira } from "@/lib/format";
import { addOne, cartServerSnapshot, cartSnapshot, setQty, subscribeCart } from "@/lib/order/cart";
import type { Drink } from "@/lib/types";
import { CartBar } from "./CartBar";

type Section = { key: string; title: string; blurb: string; items: Drink[] };

export function MenuBrowser({
  sections,
  merch,
  address,
  initialTab,
}: {
  sections: Section[];
  merch: Drink[];
  address: string;
  initialTab: "menu" | "merch";
}) {
  const [tab, setTab] = useState<"menu" | "merch">(initialTab);
  const cart = useSyncExternalStore(subscribeCart, cartSnapshot, cartServerSnapshot);
  const qty = useMemo(() => new Map(cart.map((l) => [l.id, l.qty])), [cart]);
  const all = useMemo(() => [...sections.flatMap((s) => s.items), ...merch], [sections, merch]);

  return (
    <>
      <div className="sticky top-0 z-20 bg-cream/95 px-5 pt-3 pb-3 backdrop-blur">
        <div className="grid grid-cols-2 rounded-full bg-surface p-1" role="tablist" aria-label="Menu or merch">
          {(["menu", "merch"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-10 rounded-full text-sm font-semibold transition-colors ${tab === t ? "bg-olive-deep text-cream" : "text-muted"}`}
            >
              {t === "menu" ? "Food & drinks" : "Merch"}
            </button>
          ))}
        </div>
        {tab === "menu" && sections.length > 0 && (
          <nav className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5" aria-label="Menu sections">
            {sections.map((s) => (
              <a key={s.key} href={`#${slug(s.key)}`} className="h-9 shrink-0 rounded-full border border-line bg-surface px-4 text-sm leading-9 font-medium hover:border-ink/30">
                {s.title}
              </a>
            ))}
          </nav>
        )}
      </div>

      {tab === "menu" ? (
        sections.length === 0 ? (
          <p className="mx-5 mt-6 rounded-[var(--radius-card)] bg-surface p-5 text-muted">The menu is being prepared. Check back soon.</p>
        ) : (
          sections.map((s) => (
            <section key={s.key} id={slug(s.key)} className="scroll-mt-32 px-5 pt-6" aria-labelledby={`h-${slug(s.key)}`}>
              <div className="flex items-baseline justify-between">
                <h2 id={`h-${slug(s.key)}`} className="type-heading text-2xl">
                  {s.title}
                </h2>
                {s.blurb && <p className="text-sm text-muted">{s.blurb}</p>}
              </div>
              <ul className={`mt-3 grid gap-3 ${s.key === "Our Picks" ? "grid-cols-1" : "grid-cols-2"}`}>
                {s.items.map((d) => (
                  <li key={d.id}>
                    <ItemCard d={d} qty={qty.get(d.id) ?? 0} wide={s.key === "Our Picks"} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )
      ) : (
        <section className="px-5 pt-5" aria-label="Merch">
          <div className="rounded-[var(--radius-card)] bg-olive-deep p-5 text-cream">
            <p className="type-heading text-xl">Merch 1.0</p>
            <p className="mt-1 text-sm text-cream/80">Pick it up in store at {address}. Add pieces to your order and pay when you collect.</p>
          </div>
          {merch.length === 0 ? (
            <p className="mt-4 rounded-[var(--radius-card)] bg-surface p-5 text-muted">New merch is on its way.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {merch.map((d) => (
                <li key={d.id}>
                  <ItemCard d={d} qty={qty.get(d.id) ?? 0} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <CartBar items={all} />
    </>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function ItemCard({ d, qty, wide = false }: { d: Drink; qty: number; wide?: boolean }) {
  const orderable = d.price_naira !== null;
  return (
    <article className={`flex h-full overflow-hidden rounded-[var(--radius-card)] bg-surface ${wide ? "flex-row" : "flex-col"}`}>
      <div className={`relative shrink-0 p-2 ${wide ? "h-40 w-36" : "h-44"}`} style={{ background: `${d.accent_color === "#1D2119" ? "#A9B89A" : d.accent_color}2e` }}>
        <DrinkImage name={d.name} imageUrl={d.image_url} accent={d.accent_color} art={d.art} id={d.id} />
        {d.is_reward_eligible && (
          <span className="absolute top-2 left-2">
            <Badge tone="olive">Reward</Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="leading-snug font-semibold">{d.name}</h3>
        {d.description && <p className="mt-1 line-clamp-3 text-[0.8rem] leading-relaxed text-muted">{d.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="type-heading tabular text-lg">{naira(d.price_naira)}</p>
          {orderable &&
            (qty === 0 ? (
              <button
                onClick={() => addOne(d.id)}
                aria-label={`Add ${d.name} to your order`}
                className="grid size-10 place-items-center rounded-full bg-ink text-cream transition-transform active:scale-90"
              >
                <Icon name="plus" className="size-5" />
              </button>
            ) : (
              <div className="flex items-center gap-1 rounded-full bg-sage-mist p-1" aria-label={`${qty} in your order`}>
                <button onClick={() => setQty(d.id, qty - 1)} aria-label={`Remove one ${d.name}`} className="grid size-8 place-items-center rounded-full bg-surface">
                  <Icon name="minus" className="size-4" />
                </button>
                <span className="tabular w-5 text-center text-sm font-bold">{qty}</span>
                <button onClick={() => addOne(d.id)} aria-label={`Add one more ${d.name}`} className="grid size-8 place-items-center rounded-full bg-ink text-cream">
                  <Icon name="plus" className="size-4" />
                </button>
              </div>
            ))}
        </div>
      </div>
    </article>
  );
}
