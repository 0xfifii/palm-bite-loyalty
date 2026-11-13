"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { naira } from "@/lib/format";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { cancelMyOrder } from "@/app/(customer)/order/actions";
import type { Order } from "@/lib/types";

export function MyOrders({ orders, dates }: { orders: Order[]; dates: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (orders.length === 0) return <p className="text-sm text-muted">Orders you place in the app appear here.</p>;
  return (
    <ul className="divide-y divide-line">
      {orders.map((o) => (
        <li key={o.id} className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="tabular font-semibold">
                {o.reference} <span className="font-normal text-muted">{naira(o.total_naira)}</span>
              </p>
              <p className="text-sm text-muted">
                {dates[o.id]}, {o.items.reduce((s, i) => s + i.qty, 0)} items
              </p>
            </div>
            <OrderStatusBadge status={o.status} />
          </div>
          {o.status === "new" && (
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await cancelMyOrder(o.id);
                  if (!res.ok) setError(res.error ?? "Couldn't cancel.");
                  else router.refresh();
                })
              }
              className="mt-2 text-sm font-semibold text-danger underline underline-offset-4"
            >
              Cancel this order
            </button>
          )}
        </li>
      ))}
      {error && <li className="py-2 text-sm text-danger">{error}</li>}
    </ul>
  );
}
