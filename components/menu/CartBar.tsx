"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { naira } from "@/lib/format";
import { cartServerSnapshot, cartSnapshot, subscribeCart } from "@/lib/order/cart";
import type { Drink } from "@/lib/types";

/** Floating "your order" bar, shown while the basket has items. */
export function CartBar({ items }: { items: Pick<Drink, "id" | "price_naira">[] }) {
  const cart = useSyncExternalStore(subscribeCart, cartSnapshot, cartServerSnapshot);
  const prices = new Map(items.map((i) => [i.id, i.price_naira ?? 0]));
  const lines = cart.filter((l) => prices.has(l.id));
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * (prices.get(l.id) ?? 0), 0);
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--safe-bottom)+6.25rem)] z-30 mx-auto max-w-md px-4">
      <Link
        href="/order"
        className="animate-rise pointer-events-auto flex h-14 items-center justify-between rounded-full bg-peach pr-2 pl-5 font-semibold text-olive-night shadow-lift"
      >
        <span className="flex items-center gap-2">
          <Icon name="bag" className="size-5" />
          {count} {count === 1 ? "item" : "items"}
          <span className="tabular text-olive-night/70">{naira(total)}</span>
        </span>
        <span className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-cream">
          Review order <Icon name="arrow" className="size-4" />
        </span>
      </Link>
    </div>
  );
}
