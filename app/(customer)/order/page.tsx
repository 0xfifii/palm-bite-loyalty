import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadBusiness, loadDrinks } from "@/lib/loyalty/queries";
import { OrderReview } from "./OrderReview";

export const metadata: Metadata = { title: "Your order" };

export default async function OrderPage() {
  const { supabase } = await requireUser("/order");
  const [items, business] = await Promise.all([loadDrinks(supabase), loadBusiness(supabase)]);
  return (
    <OrderReview
      menu={items.filter((d) => d.price_naira !== null).map((d) => ({ id: d.id, name: d.name, price: d.price_naira!, art: d.art, accent: d.accent_color, image: d.image_url, merch: d.item_type === "merch" }))}
      address={business.store_address}
    />
  );
}
