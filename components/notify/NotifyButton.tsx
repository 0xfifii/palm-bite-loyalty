"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { savePushSubscription } from "@/lib/notify/actions";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "unsupported" | "off" | "on" | "blocked" | "working";

/**
 * Turns on phone notifications for order updates. On iPhone this works once
 * Palm Bite is added to the home screen (Share, then Add to Home Screen).
 */
export function NotifyButton({ label = "Turn on order notifications", tone = "light" }: { label?: string; tone?: "light" | "dark" }) {
  const [state, setState] = useState<State>("off");

  useEffect(() => {
    const supported = Boolean(KEY) && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported || Notification.permission === "denied") {
      // Settled after paint so the first render matches the server.
      const t = setTimeout(() => setState(supported ? "blocked" : "unsupported"), 0);
      return () => clearTimeout(t);
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (s) => {
        if (s && Notification.permission === "granted") {
          // Refresh the saved copy in case it moved accounts or devices.
          await savePushSubscription(s.toJSON());
          setState("on");
        }
      })
      .catch(() => undefined);
  }, []);

  async function enable() {
    if (!KEY) return;
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
      const res = await savePushSubscription(s.toJSON());
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  if (state === "unsupported") return null;
  const base = tone === "dark" ? "bg-olive-deep text-cream" : "bg-sage-soft text-olive-night";
  if (state === "on") {
    return (
      <p className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${base}`}>
        <Icon name="check" className="size-4" /> Notifications are on for this phone
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className="rounded-2xl bg-cream px-4 py-3 text-sm text-muted">
        Notifications are blocked for Palm Bite. Turn them on in your phone or browser settings to get order updates.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void enable()}
      disabled={state === "working"}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold active:scale-[0.98] ${base}`}
    >
      <Icon name="bell" className="size-4" /> {state === "working" ? "Turning on..." : label}
    </button>
  );
}
