import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { OrdersBoard, type BoardView, type HistoryFilter } from "@/components/orders/OrdersBoard";
import { AutoRefresh } from "@/components/orders/OrderActions";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; filter?: string }> }) {
  await requireRole(["staff", "admin"], "/staff/orders");
  const sp = await searchParams;
  const view: BoardView = sp.view === "active" || sp.view === "history" ? sp.view : "new";
  const filter: HistoryFilter = sp.filter === "mine" || sp.filter === "cancelled" ? sp.filter : "all";
  return (
    <>
      <AutoRefresh seconds={10} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="type-heading text-[1.9rem]">Orders</h1>
          <p className="mt-1 text-muted">Confirm an order to take charge of it, set the ready time, then move it along.</p>
        </div>
      </div>
      <Link href="/staff/new-order" className="mb-5 flex h-14 items-center justify-center gap-2 rounded-full bg-peach font-semibold text-olive-night shadow-soft active:scale-[0.99] sm:max-w-xs">
        <Icon name="plus" className="size-5" /> New order for a customer
      </Link>
      <OrdersBoard base="/staff/orders" view={view} filter={filter} customerLinks={false} />
    </>
  );
}
