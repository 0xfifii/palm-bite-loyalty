import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { groupMenu, loadBusiness, loadDrinks } from "@/lib/loyalty/queries";
import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Menu: coffee, fresh juice, pastries and merch",
  description:
    "The Palm Bite Cafe menu with prices: signature Gems like the Palms Frappuccino and Melis, matcha, lattes, fresh hibiscus, pineapple and watermelon juice, Slab, meat pie, croissant and Palm merch.",
  alternates: { canonical: "/menu" },
  openGraph: { url: "/menu", title: "Palm Bite Cafe menu" },
};

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const [items, business, sp] = await Promise.all([loadDrinks(supabase), loadBusiness(supabase), searchParams]);
  const { sections, merch } = groupMenu(items);
  const menuLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${SITE_URL}/menu#menu`,
    name: "Palm Bite Cafe menu",
    url: absoluteUrl("/menu"),
    inLanguage: "en-NG",
    hasMenuSection: sections.map((s) => ({
      "@type": "MenuSection",
      name: s.title,
      hasMenuItem: s.items.map((d) => ({
        "@type": "MenuItem",
        name: d.name,
        ...(d.description ? { description: d.description } : {}),
        ...(d.image_url ? { image: d.image_url.startsWith("http") ? d.image_url : absoluteUrl(d.image_url) } : {}),
        ...(d.price_naira !== null ? { offers: { "@type": "Offer", price: d.price_naira, priceCurrency: "NGN" } } : {}),
      })),
    })),
  };
  return (
    <main className="pt-[calc(var(--safe-top)+1.25rem)]">
      <JsonLd data={menuLd} />
      <div className="px-5 md:px-8">
        <p className="text-sm font-semibold text-olive">pour. sip. stay a while.</p>
        <h1 className="type-display mt-1 text-[3rem] text-olive-deep uppercase">Menu</h1>
      </div>
      <MenuBrowser sections={sections} merch={merch} address={business.store_address} initialTab={sp.tab === "merch" ? "merch" : "menu"} />
    </main>
  );
}
