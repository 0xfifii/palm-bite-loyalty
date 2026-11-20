"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { setOrderEta, setOrderPayment, updateOrderStatus } from "@/app/staff/actions";
import { CANCEL_REASONS, ETA_CHOICES, nextStep } from "@/lib/order/status";
import type { Order } from "@/lib/types";

type ActionOrder = Pick<Order, "id" | "status" | "fulfilment" | "payment_status" | "accepted_by" | "accepted_by_name" | "eta_minutes">;

function Chips<T extends string | number>({ items, value, onChange, label }: { items: readonly T[]; value: T | null; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`h-10 rounded-full px-3.5 text-sm font-semibold transition-colors ${value === v ? "bg-olive-deep text-cream" : "bg-sage-mist text-ink hover:bg-sage-soft"}`}
        >
          {label(v)}
        </button>
      ))}
    </div>
  );
}

export function OrderActions({ order, meId, isAdmin }: { order: ActionOrder; meId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "cancel" | "eta">("none");
  const [eta, setEta] = useState<number>(order.eta_minutes ?? 15);
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const next = nextStep(order.status, order.fulfilment);
  const closed = order.status === "completed" || order.status === "cancelled";
  const lockedOut = Boolean(order.accepted_by && order.accepted_by !== meId && !isAdmin);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else {
        setPanel("none");
        router.refresh();
      }
    });

  if (closed) {
    return order.payment_status !== "paid" && order.status !== "cancelled" ? (
      <Button variant="outline" size="md" disabled={pending} onClick={() => run(() => setOrderPayment(order.id, true))}>
        <Icon name="check" className="size-4" /> Payment received
      </Button>
    ) : null;
  }

  if (lockedOut) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-sage-mist px-3 py-2.5 text-sm font-semibold">
        <Icon name="shield" className="size-4" /> {order.accepted_by_name ?? "Another team member"} is in charge of this order
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {order.status === "new" ? (
        <div className="space-y-3 rounded-2xl bg-cream p-3">
          <p className="text-sm font-semibold">How long will it take?</p>
          <Chips items={ETA_CHOICES} value={eta} onChange={setEta} label={(m) => `${m} min`} />
          <Button variant="olive" size="lg" full disabled={pending} onClick={() => run(() => updateOrderStatus(order.id, "confirmed", null, eta))}>
            {pending ? "Saving..." : `Confirm and take charge (${eta} min)`}
          </Button>
        </div>
      ) : (
        next && (
          <Button variant="olive" size="lg" full disabled={pending} onClick={() => run(() => updateOrderStatus(order.id, next.status))}>
            {pending ? "Saving..." : next.label}
          </Button>
        )
      )}

      {order.status === "ready" && order.fulfilment === "delivery" && (
        <Button variant="outline" size="md" full disabled={pending} onClick={() => run(() => updateOrderStatus(order.id, "completed"))}>
          Received
        </Button>
      )}

      <div className="flex flex-wrap gap-2">
        {order.payment_status !== "paid" && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setOrderPayment(order.id, true))}>
            <Icon name="check" className="size-4" /> Payment received
          </Button>
        )}
        {order.status !== "new" && (
          <Button variant="ghost" size="sm" onClick={() => setPanel(panel === "eta" ? "none" : "eta")}>
            <Icon name="clock" className="size-4" /> Ready time
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setPanel(panel === "cancel" ? "none" : "cancel")}>
          Cancel order
        </Button>
      </div>

      {panel === "eta" && (
        <div className="space-y-3 rounded-2xl bg-cream p-3">
          <p className="text-sm font-semibold">New ready time</p>
          <Chips items={ETA_CHOICES} value={eta} onChange={setEta} label={(m) => `${m} min`} />
          <Button variant="dark" size="md" disabled={pending} onClick={() => run(() => setOrderEta(order.id, eta))}>
            Save {eta} min
          </Button>
        </div>
      )}

      {panel === "cancel" && (
        <div className="space-y-3 rounded-2xl bg-danger-soft p-3">
          <p className="text-sm font-semibold">Why are you cancelling? The customer will see this.</p>
          <Chips items={CANCEL_REASONS} value={reason as (typeof CANCEL_REASONS)[number] | null} onChange={(v) => setReason(v)} label={(v) => v} />
          <input
            value={other}
            onChange={(e) => {
              setOther(e.target.value.slice(0, 160));
              setReason(null);
            }}
            placeholder="Or type another reason"
            className="h-11 w-full rounded-2xl border border-line bg-surface px-4 text-sm outline-none focus:border-olive"
          />
          <div className="flex gap-2">
            <Button
              variant="dark"
              size="md"
              disabled={pending || !(reason || other.trim().length >= 2)}
              onClick={() => run(() => updateOrderStatus(order.id, "cancelled", reason ?? other.trim()))}
            >
              Cancel this order
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPanel("none")}>
              Keep it
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
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
