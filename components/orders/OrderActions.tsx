"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { setOrderPayment, updateOrderStatus } from "@/app/staff/actions";
import { nextStep } from "@/lib/order/status";
import type { Order } from "@/lib/types";

export function OrderActions({ order }: { order: Pick<Order, "id" | "status" | "fulfilment" | "payment_status"> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const next = nextStep(order.status, order.fulfilment);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else router.refresh();
    });

  if (!next && order.payment_status === "paid") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {next && (
        <Button variant="olive" size="md" disabled={pending} onClick={() => run(() => updateOrderStatus(order.id, next.status))}>
          {pending ? "Saving..." : next.label}
        </Button>
      )}
      {order.payment_status !== "paid" && order.status !== "cancelled" && (
        <Button variant="outline" size="md" disabled={pending} onClick={() => run(() => setOrderPayment(order.id, true))}>
          <Icon name="check" className="size-4" /> Payment received
        </Button>
      )}
      {next &&
        (confirmCancel ? (
          <>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => updateOrderStatus(order.id, "cancelled"))}>
              Yes, cancel it
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmCancel(true)}>
            Cancel order
          </Button>
        ))}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Refreshes the page every few seconds so new orders and updates appear. */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, seconds]);
  return null;
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18, 0.36].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = [880, 1175, 1568][i];
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.32);
    });
  } catch {
    /* sound not available */
  }
}

/**
 * Plays a chime and shows a banner when something new needs attention:
 * a new order, a receipt, or a Palm Fren saying go ahead. `signal` is a
 * string that changes whenever there is something new.
 */
export function NewOrderAlert({ signal, newCount }: { signal: string; newCount: number }) {
  const last = useRef<string | null>(null);
  const [show, setShow] = useState(false);
  const [sound, setSound] = useState(false);
  useEffect(() => {
    if (last.current !== null && signal !== last.current) {
      setShow(true);
      if (sound) chime();
      if ("vibrate" in navigator) navigator.vibrate?.([150, 80, 150]);
    }
    last.current = signal;
  }, [signal, sound]);
  return (
    <div className="mb-4 space-y-2">
      {!sound && (
        <button
          type="button"
          onClick={() => {
            setSound(true);
            chime();
          }}
          className="flex h-11 items-center gap-2 rounded-full bg-sage-soft px-4 text-sm font-semibold text-olive-night"
        >
          <Icon name="bell" className="size-4" /> Turn on order sound for this screen
        </button>
      )}
      {show && (
        <button
          type="button"
          onClick={() => setShow(false)}
          className="flex w-full items-center justify-between rounded-2xl bg-peach px-4 py-3 text-left font-semibold text-olive-night"
          role="status"
        >
          <span className="flex items-center gap-2">
            <Icon name="bell" className="size-5" /> Something new on the orders board{newCount > 0 ? `: ${newCount} waiting to be confirmed` : ""}
          </span>
          <Icon name="close" className="size-4" />
        </button>
      )}
    </div>
  );
}
