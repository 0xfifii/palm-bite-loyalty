"use client";

import { useMemo, useState } from "react";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import { Badge } from "@/components/ui/Badge";
import type { Drink } from "@/lib/types";

export function DrinkMenu({ drinks }: { drinks: Drink[] }) {
  const categories = useMemo(() => ["All", ...Array.from(new Set(drinks.map((d) => d.category)))], [drinks]);
  const [active, setActive] = useState("All");
  const shown = active === "All" ? drinks : drinks.filter((d) => d.category === active);

  if (drinks.length === 0) {
    return <p className="mt-8 rounded-[var(--radius-card)] bg-surface p-5 text-muted">The menu is being prepared. Check back soon.</p>;
  }

  return (
    <>
      <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5" role="tablist" aria-label="Drink categories">
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={active === c}
            onClick={() => setActive(c)}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
              active === c ? "border-olive-deep bg-olive-deep text-cream" : "border-line bg-surface text-ink hover:border-ink/30"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3">
        {shown.map((d) => (
          <li key={d.id} className="overflow-hidden rounded-[var(--radius-card)] bg-surface">
            <div className="relative h-48 p-3" style={{ background: `${d.accent_color}2e` }}>
              <DrinkImage name={d.name} imageUrl={d.image_url} accent={d.accent_color} id={d.id} />
              <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
                {d.is_reward_eligible && <Badge tone="olive">Reward</Badge>}
                {d.is_sample && <Badge tone="peach">Sample</Badge>}
              </div>
            </div>
            <div className="p-4">
              <p className="leading-snug font-semibold">{d.name}</p>
              {d.description && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">{d.description}</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
