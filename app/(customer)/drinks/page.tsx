import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadDrinks } from "@/lib/loyalty/queries";
import { DrinkMenu } from "./DrinkMenu";

export const metadata: Metadata = { title: "Drinks" };

export default async function DrinksPage() {
  const { supabase } = await requireUser("/drinks");
  const drinks = await loadDrinks(supabase);
  return (
    <main className="px-5 pt-[calc(var(--safe-top)+1.5rem)]">
      <h1 className="type-display text-[3rem] text-olive-deep uppercase">Drinks</h1>
      <p className="mt-2 text-muted">Drinks marked Reward can be chosen as your free drink.</p>
      {drinks.some((d) => d.is_sample) && (
        <p className="mt-3 rounded-2xl bg-peach-soft px-4 py-3 text-sm text-olive-night">
          This menu shows sample drinks while Palm Bite adds its real menu.
        </p>
      )}
      <DrinkMenu drinks={drinks} />
    </main>
  );
}
