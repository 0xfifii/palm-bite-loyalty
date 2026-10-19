"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";

type Session = { svg: string; expiresAt: number; ttl: number; sessionId: string; offset: number };

/**
 * In-store visit QR display. Each code is minted by the server, signed, valid
 * for the configured lifetime (60 seconds by default) and replaced
 * automatically before it expires. An expired code is never left on screen.
 */
export function QrDisplay({ exitHref }: { exitHref: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<"loading" | "live" | "reconnecting" | "forbidden">("loading");
  const inflight = useRef(false);
  const failures = useRef(0);

  const mint = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/qr/session", { method: "POST", cache: "no-store", credentials: "same-origin" });
      if (res.status === 401 || res.status === 403) {
        setStatus("forbidden");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setSession({
        svg: data.svg,
        expiresAt: Date.parse(data.expiresAt),
        ttl: data.ttlSeconds,
        sessionId: data.sessionId,
        offset: Date.parse(data.serverNow) - Date.now(),
      });
      setStatus("live");
      failures.current = 0;
    } catch {
      failures.current += 1;
      setStatus("reconnecting");
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void mint(), 0);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, [mint]);

  const serverNow = now + (session?.offset ?? 0);
  const remainingMs = session ? Math.max(0, session.expiresAt - serverNow) : 0;
  const lead = session ? Math.min(10_000, (session.ttl * 1000) / 4) : 0;
  const expired = !session || remainingMs <= 0;

  // Rotate before expiry; back off while the network is failing.
  useEffect(() => {
    if (status === "forbidden") return;
    if (session && remainingMs > lead) return;
    if (!session && status === "loading") return; // first mint is already in flight
    const wait = status === "reconnecting" ? Math.min(15000, 1000 * 2 ** Math.min(failures.current, 4)) : 0;
    const t = setTimeout(() => void mint(), wait);
    return () => clearTimeout(t);
  }, [session, remainingMs, lead, status, mint]);

  // Keep the display awake where supported.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const request = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    void request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const seconds = Math.ceil(remainingMs / 1000);
  const progress = session ? Math.min(1, remainingMs / (session.ttl * 1000)) : 0;
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-olive px-6 py-8 text-cream">
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
          className="rounded-full bg-cream/12 px-4 py-2 text-sm font-semibold hover:bg-cream/20"
        >
          Full screen
        </button>
        <Link href={exitHref} className="rounded-full bg-cream/12 px-4 py-2 text-sm font-semibold hover:bg-cream/20">
          Exit
        </Link>
      </div>

      <div className="mt-6 text-peach">
        <Wordmark height={44} />
      </div>

      <h1 className="type-display mt-8 max-w-4xl text-center text-[clamp(2.2rem,6vw,4.6rem)] text-cream uppercase">
        Scan to Collect Your Palm Bite Point.
      </h1>

      <div className="mt-10 flex flex-1 flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
        <div className="relative rounded-[2.25rem] bg-white p-5 shadow-lift">
          <div className="relative size-[min(70vw,56vh,460px)]">
            {status !== "forbidden" && session && !expired ? (
              <div
                key={session.sessionId}
                className="animate-splash-in size-full [&>svg]:size-full"
                role="img"
                aria-label="Palm Bite visit QR code"
                dangerouslySetInnerHTML={{ __html: session.svg }}
              />
            ) : (
              <div className="grid size-full place-items-center text-center text-olive-night" role="status">
                {status === "forbidden" ? (
                  <p className="max-w-[16rem] font-semibold">Sign in with a staff account to show the visit code.</p>
                ) : (
                  <p className="max-w-[16rem] font-semibold">{status === "reconnecting" ? "Reconnecting. A new code will appear shortly." : "Preparing a fresh code..."}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex max-w-sm flex-col items-center gap-8 lg:items-start">
          <div className="flex items-center gap-4" aria-live="off">
            <svg viewBox="0 0 100 100" className="size-24 -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r={R} stroke="currentColor" strokeOpacity="0.18" strokeWidth="8" fill="none" />
              <circle
                cx="50"
                cy="50"
                r={R}
                stroke="var(--color-peach)"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                style={{ transition: "stroke-dashoffset 250ms linear" }}
              />
            </svg>
            <div>
              <p className="type-heading tabular text-4xl">{session && !expired ? `${seconds}s` : "--"}</p>
              <p className="text-sm text-cream/75">until this code refreshes</p>
            </div>
          </div>

          <ol className="space-y-4 text-lg">
            {[
              "Open Palm Bite Loyalty on your phone.",
              "Tap Scan & Earn.",
              "Point your camera at this code.",
            ].map((step, i) => (
              <li key={step} className="flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-peach font-bold text-olive-night">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <p className="flex items-center gap-2 text-sm text-cream/75">
            <Icon name="shield" className="size-4" /> One point per guest per day. Codes change every minute.
          </p>
        </div>
      </div>
    </main>
  );
}
