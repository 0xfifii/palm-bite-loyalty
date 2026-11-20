"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { NotifyButton } from "@/components/notify/NotifyButton";
import { sendTestNotification } from "@/lib/notify/actions";

type Row = { label: string; ok: boolean | null; fix?: string };

export function NotificationCheck() {
  const [rows, setRows] = useState<Row[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function inspect() {
    const key = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const sw = "serviceWorker" in navigator;
    const push = "PushManager" in window && "Notification" in window;
    let reg: ServiceWorkerRegistration | undefined;
    let sub: PushSubscription | null = null;
    if (sw) {
      reg = await navigator.serviceWorker.getRegistration();
      sub = reg ? await reg.pushManager?.getSubscription().catch(() => null) : null;
    }
    const perm = push ? Notification.permission : "unsupported";
    setRows([
      { label: "Palm Bite notification keys are set up", ok: key, fix: "The owner needs to add the three VAPID keys in Vercel, then Redeploy." },
      ...(ios ? [{ label: "Opened from the home screen icon (iPhone)", ok: standalone, fix: "On iPhone, add Palm Bite to the home screen (Share, then Add to Home Screen) and open it from that icon." }] : []),
      { label: "This browser supports notifications", ok: push && sw, fix: ios ? "Update the iPhone to iOS 16.4 or newer." : "Use Chrome on Android." },
      { label: "Palm Bite is ready in the background", ok: Boolean(reg), fix: "Close the app completely and open it again." },
      { label: "Notifications allowed for Palm Bite", ok: perm === "granted", fix: perm === "denied" ? "Notifications are blocked. Turn them on in phone Settings for Palm Bite or Chrome." : "Tap the button below and choose Allow." },
      { label: "This phone is registered for order updates", ok: Boolean(sub), fix: "Tap the button below." },
    ]);
  }

  useEffect(() => {
    const t = setTimeout(() => void inspect(), 0);
    return () => clearTimeout(t);
  }, []);

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const r = await sendTestNotification();
      if (!r.configured) setResult("The notification keys are missing on the server. Add them in Vercel, then Redeploy.");
      else if (!r.devices) setResult("This account has no phone registered yet. Tap the button above and choose Allow, then try again.");
      else if (r.sent > 0) setResult(`Sent to ${r.sent} ${r.sent === 1 ? "device" : "devices"}. Switch to another app: it should arrive in a few seconds.`);
      else setResult(`Sending failed: ${r.failed.map((f) => `${f.status ?? ""} ${f.message}`).join("; ")}`);
    } catch {
      setResult("Couldn't reach Palm Bite. Check your internet and try again.");
    } finally {
      setBusy(false);
      void inspect();
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-surface px-4">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 py-3">
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${r.ok ? "bg-olive-deep text-cream" : "bg-danger-soft text-danger"}`}>
              <Icon name={r.ok ? "check" : "close"} className="size-3.5" />
            </span>
            <div>
              <p className="font-semibold">{r.label}</p>
              {!r.ok && r.fix && <p className="text-sm text-muted">{r.fix}</p>}
            </div>
          </li>
        ))}
      </ul>
      <NotifyButton label="Allow notifications on this phone" />
      <button
        type="button"
        disabled={busy}
        onClick={() => void test()}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-cream active:scale-[0.98]"
      >
        <Icon name="bell" className="size-4" /> {busy ? "Sending..." : "Send me a test notification"}
      </button>
      {result && <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm text-olive-night" aria-live="polite">{result}</p>}
    </div>
  );
}
