import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { loadBusiness, loadDrinks } from "@/lib/loyalty/queries";
import { StaffOrderForm } from "./StaffOrderForm";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const { supabase } = await requireRole(["staff", "admin"], "/staff/new-order");
  const [items, business] = await Promise.all([loadDrinks(supabase), loadBusiness(supabase)]);
  return (
    <>
      <h1 className="type-heading text-[1.9rem]">New order for a customer</h1>
      <p className="mt-1 mb-6 text-muted">For orders taken at the counter or on the phone. You will be in charge of it.</p>
      <StaffOrderForm
        menu={items
          .filter((d) => d.price_naira !== null)
          .map((d) => ({ id: d.id, name: d.name, price: d.price_naira!, category: d.category, image: d.image_url }))}
        deliveryFee={business.delivery_fee_naira}
      />
    </>
  );
}
