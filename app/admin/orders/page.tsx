import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { OrdersBoard, type BoardView, type HistoryFilter } from "@/components/orders/OrdersBoard";
import { AutoRefresh } from "@/components/orders/OrderActions";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; filter?: string }> }) {
  await requireRole(["admin"], "/admin/orders");
  const sp = await searchParams;
  const view: BoardView = sp.view === "active" || sp.view === "history" ? sp.view : "new";
  const filter: HistoryFilter = sp.filter === "mine" || sp.filter === "cancelled" ? sp.filter : "all";
  return (
    <>
      <AutoRefresh seconds={10} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-heading text-[1.9rem]">Orders</h1>
          <p className="mt-1 text-muted">Confirm an order to take charge of it, set the ready time, then move it along.</p>
        </div>
      </div>
      <OrdersBoard base="/admin/orders" view={view} filter={filter} customerLinks={true} />
    </>
  );
}
