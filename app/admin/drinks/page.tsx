import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import type { Drink } from "@/lib/types";
import { naira } from "@/lib/format";

export const metadata: Metadata = { title: "Menu & merch" };

export default async function AdminDrinksPage() {
  const { supabase } = await requireRole(["admin"], "/admin/drinks");
  const { data } = await supabase.from("drinks").select("*").order("sort_order").order("name");
  const drinks = (data ?? []) as Drink[];
  const samples = drinks.filter((d) => d.is_sample).length;

  return (
    <>
      <PageHeader
        title="Menu & merch"
        description="Everything on the menu and in the merch shop. Only drinks can be chosen as the free reward."
        actions={
          <ButtonLink href="/admin/drinks/new" variant="olive" icon="plus">
            Add an item
          </ButtonLink>
        }
      />
      {samples > 0 && (
        <div className="mb-6 rounded-[var(--radius-card)] bg-peach-soft p-4 text-sm text-olive-night">
          {samples} sample {samples === 1 ? "drink is" : "drinks are"} still on the menu. Replace them with Palm Bite&apos;s real drinks, or deactivate them.
        </div>
      )}
      <Panel>
        {drinks.length === 0 ? (
          <p className="text-muted">No drinks yet. Add the first one to build the menu.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {drinks.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/drinks/${d.id}`} className="flex gap-4 rounded-2xl border border-line p-3 transition-colors hover:border-olive">
                  <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl p-1" style={{ background: `${d.accent_color}2e` }}>
                    <DrinkImage name={d.name} imageUrl={d.image_url} accent={d.accent_color} art={d.art} id={d.id} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-sm text-muted">
                      {d.category}
                      {d.price_naira !== null ? `, ${naira(d.price_naira)}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.is_active ? <Badge tone="sage">Active</Badge> : <Badge tone="muted">Hidden</Badge>}
                      {d.is_reward_eligible && <Badge tone="olive">Reward</Badge>}
                      {d.is_sample && <Badge tone="peach">Sample</Badge>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
