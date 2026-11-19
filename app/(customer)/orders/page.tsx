import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadBusiness } from "@/lib/loyalty/queries";
import { formatDateTime } from "@/lib/format";
import { OrdersList } from "./OrdersList";
import { AutoRefresh } from "@/components/orders/OrderActions";
import { OPEN_STATUSES } from "@/lib/order/status";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const { supabase, user } = await requireUser("/orders");
  const [{ data }, business, { data: settings }] = await Promise.all([
    supabase.from("orders").select("*").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100),
    loadBusiness(supabase),
    supabase.from("app_settings").select("business_timezone").single(),
  ]);
  const orders = (data ?? []) as Order[];
  const tz = settings?.business_timezone ?? "Africa/Lagos";
  return (
    <main className="px-5 md:px-8 pt-[calc(var(--safe-top)+1.5rem)]">
      {orders.some((o) => OPEN_STATUSES.includes(o.status)) && <AutoRefresh seconds={15} />}
      <h1 className="type-display text-[3rem] text-olive-deep uppercase">Orders</h1>
      <p className="mt-1 text-muted">Order from the menu and keep track of everything you&apos;ve ordered.</p>
      <OrdersList
        orders={orders}
        dates={Object.fromEntries(orders.map((o) => [o.id, formatDateTime(o.created_at, tz)]))}
        business={business}
        userId={user.id}
      />
    </main>
  );
}
