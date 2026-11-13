import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { OrdersBoard } from "@/components/orders/OrdersBoard";
import { AutoRefresh } from "@/components/orders/OrderActions";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireRole(["admin"], "/admin/orders");
  const { show } = await searchParams;
  const done = show === "done";
  return (
    <>
      <AutoRefresh />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-heading text-[1.9rem]">Orders</h1>
          <p className="mt-1 text-muted">Orders Palm Frens send from the app. Confirm on WhatsApp, then move each order along.</p>
        </div>
        <div className="flex gap-2 rounded-full bg-surface p-1 text-sm font-semibold">
          <Link href="/admin/orders" className={`rounded-full px-4 py-2 ${!done ? "bg-olive-deep text-cream" : "text-muted"}`}>
            Open
          </Link>
          <Link href="/admin/orders?show=done" className={`rounded-full px-4 py-2 ${done ? "bg-olive-deep text-cream" : "text-muted"}`}>
            Finished
          </Link>
        </div>
      </div>
      <OrdersBoard show={done ? "done" : "open"} customerLinks={true} />
    </>
  );
}
