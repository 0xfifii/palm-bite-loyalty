"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { chime, soundReady, unlockSound } from "@/lib/notify/chime";
import { customerUpdate } from "@/lib/order/status";
import { naira } from "@/lib/format";
import type { Order } from "@/lib/types";

type Banner = { id: string; title: string; body: string; href: string };

type StaffRow = { id: string; reference: string; status: string; payment: string; goAhead: string | null; total: number };
type FrenRow = Pick<Order, "id" | "reference" | "status" | "fulfilment" | "payment_status" | "accepted_by_name">;

/**
 * Watches orders while the app is open and shows a banner with a sound when
 * something happens. Staff: new orders, receipts and "go ahead". Palm Frens:
 * every status change and payment confirmation on their own orders.
 */
export function OrderAlerts({ mode }: { mode: "staff" | "fren" }) {
  const router = useRouter();
  const path = usePathname();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const seen = useRef<Map<string, string> | null>(null);

  // Any tap anywhere unlocks sound (browsers require a tap before audio).
  useEffect(() => {
    const unlock = () => {
      unlockSound();
      setTimeout(() => setSoundOn(soundReady()), 50);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const url = mode === "staff" ? "/api/orders/pulse" : "/api/orders/mine";
    const every = mode === "staff" ? 10_000 : 15_000;

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { orders: (StaffRow | FrenRow)[] };
        const next = new Map<string, string>();
        const fresh: Banner[] = [];
        let loud = false;
        for (const o of json.orders) {
          if (mode === "staff") {
            const r = o as StaffRow;
            const key = `${r.status}|${r.payment}|${r.goAhead ?? ""}`;
            next.set(r.id, key);
            const before = seen.current?.get(r.id);
            if (!seen.current) continue;
            if (before === undefined && r.status === "new") {
              loud = true;
              fresh.push({ id: `${r.id}-new`, title: `New order ${r.reference}`, body: `${naira(r.total)}. Tap to open the orders board.`, href: "/staff/orders" });
            } else if (before !== undefined && before !== key) {
              const [, payBefore, goBefore] = before.split("|");
              if (r.payment === "receipt_sent" && payBefore !== "receipt_sent")
                fresh.push({ id: `${r.id}-receipt-${Date.now()}`, title: `Receipt for ${r.reference}`, body: "A Palm Fren sent a payment receipt. Check and confirm.", href: "/staff/orders" });
              if (r.goAhead && r.goAhead !== goBefore)
                fresh.push({ id: `${r.id}-go-${Date.now()}`, title: `Go ahead on ${r.reference}`, body: "The customer says go ahead with the order.", href: "/staff/orders" });
            }
          } else {
            const r = o as FrenRow;
            const key = `${r.status}|${r.payment_status}`;
            next.set(r.id, key);
            const before = seen.current?.get(r.id);
            if (!seen.current || before === undefined || before === key) continue;
            const [statusBefore, payBefore] = before.split("|");
            if (r.status !== statusBefore) {
              const msg = customerUpdate(r.status, r.fulfilment, r.reference);
              if (msg) {
                const who = r.status === "confirmed" && r.accepted_by_name ? ` Accepted by ${r.accepted_by_name}.` : "";
                fresh.push({ id: `${r.id}-${r.status}`, title: msg.title, body: msg.body + who, href: "/orders" });
              }
            }
            if (r.payment_status === "paid" && payBefore !== "paid") {
              fresh.push({ id: `${r.id}-paid`, title: `Payment received for ${r.reference}`, body: "Thank you! Your payment has been confirmed.", href: "/orders" });
            }
          }
        }
        // Number on the home screen icon: new orders for staff, open orders for Palm Frens.
        try {
          const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
          const badge =
            mode === "staff"
              ? (json.orders as StaffRow[]).filter((r) => r.status === "new").length
              : (json.orders as FrenRow[]).filter((r) => r.status === "ready" || r.status === "on_the_way").length;
          if (badge > 0) await nav.setAppBadge?.(badge);
          else await nav.clearAppBadge?.();
        } catch {
          /* badges not supported on this device */
        }
        // First check after opening the app: show anything still waiting.
        if (!seen.current && mode === "staff") {
          const waiting = (json.orders as StaffRow[]).filter((r) => r.status === "new");
          if (waiting.length) {
            loud = true;
            fresh.push({
              id: `waiting-${waiting.map((w) => w.id).join("-")}`,
              title: waiting.length === 1 ? `Order ${waiting[0].reference} is waiting` : `${waiting.length} orders are waiting`,
              body: "Sent while you were away. Tap to confirm on the orders board.",
              href: "/staff/orders",
            });
          }
        }
        seen.current = next;
        if (!stop && fresh.length) {
          setBanners((b) => [...fresh, ...b].slice(0, 3));
          chime(loud);
          if ("vibrate" in navigator) navigator.vibrate?.(loud ? [200, 100, 200, 100, 200] : [150]);
          // Keep the visible page up to date too.
          router.refresh();
        }
      } catch {
        /* offline: try again next time */
      }
    }

    void check();
    const t = setInterval(check, every);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mode, router]);

  const showSoundHint = mode === "staff" && !soundOn;
  if (!banners.length && !showSoundHint) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex max-w-md flex-col gap-2 px-3 pt-[calc(var(--safe-top)+0.5rem)]" aria-live="assertive">
      {banners.map((b) => (
        <div key={b.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-ink p-4 text-cream shadow-lift">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-peach text-olive-night">
            <Icon name="bell" className="size-5" />
          </span>
          <Link
            href={b.href}
            onClick={() => setBanners((all) => all.filter((x) => x.id !== b.id))}
            className="min-w-0 flex-1"
          >
            <p className="font-semibold">{b.title}</p>
            <p className="text-sm text-cream/80">{b.body}</p>
          </Link>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setBanners((all) => all.filter((x) => x.id !== b.id))}
            className="grid size-8 shrink-0 place-items-center rounded-full text-cream/70 hover:bg-cream/10"
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>
      ))}
      {showSoundHint && path.startsWith("/staff/orders") && (
        <button
          type="button"
          onClick={() => {
            unlockSound();
            setTimeout(() => {
              setSoundOn(soundReady());
              chime();
            }, 50);
          }}
          className="pointer-events-auto mx-auto flex h-10 items-center gap-2 rounded-full bg-peach px-4 text-sm font-semibold text-olive-night shadow-soft"
        >
          <Icon name="bell" className="size-4" /> Tap to turn on order sound
        </button>
      )}
    </div>
  );
}
