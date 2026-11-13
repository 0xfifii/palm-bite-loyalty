"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { updateOrderStatus } from "@/app/staff/actions";
import type { Order } from "@/lib/types";

const NEXT: Partial<Record<Order["status"], { status: Order["status"]; label: string }>> = {
  new: { status: "confirmed", label: "Confirm" },
  confirmed: { status: "ready", label: "Mark ready" },
  ready: { status: "completed", label: "Completed" },
};

export function OrderActions({ id, status }: { id: string; status: Order["status"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = NEXT[status];
  const go = (s: Order["status"]) =>
    start(async () => {
      const res = await updateOrderStatus(id, s);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  if (!next) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="olive" size="sm" disabled={pending} onClick={() => go(next.status)}>
        {pending ? "Saving..." : next.label}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => go("cancelled")}>
        Cancel order
      </Button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Refreshes the board every 20 seconds so new orders appear without reloading. */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
