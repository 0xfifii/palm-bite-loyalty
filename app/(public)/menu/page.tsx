import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { groupMenu, loadBusiness, loadDrinks } from "@/lib/loyalty/queries";
import { MenuBrowser } from "@/components/menu/MenuBrowser";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const [items, business, sp] = await Promise.all([loadDrinks(supabase), loadBusiness(supabase), searchParams]);
  const { sections, merch } = groupMenu(items);
  return (
    <main className="pt-[calc(var(--safe-top)+1.25rem)]">
      <div className="px-5">
        <p className="text-sm font-semibold text-olive">pour. sip. stay a while.</p>
        <h1 className="type-display mt-1 text-[3rem] text-olive-deep uppercase">Menu</h1>
      </div>
      <MenuBrowser sections={sections} merch={merch} address={business.store_address} initialTab={sp.tab === "merch" ? "merch" : "menu"} />
    </main>
  );
}
