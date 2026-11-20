"use client";

import { useEffect, useState } from "react";

function clockTime(d: Date) {
  return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
}

/** "Ready in about 12 min (by 2:45 PM)", counting down live. */
export function EtaText({ at, minutes, staff = false }: { at: string; minutes: number | null; staff?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const due = new Date(at);
  if (now === null) return <span>{minutes ? `About ${minutes} min` : "Time set"} (by {clockTime(due)})</span>;
  const left = Math.ceil((due.getTime() - now) / 60_000);
  if (left <= 0) return <span>{staff ? `Due now (was ${clockTime(due)})` : "Any minute now"}</span>;
  return (
    <span>
      {staff ? "Due" : "Ready"} in about {left} min (by {clockTime(due)})
    </span>
  );
}

/** "12 min ago" since the order was placed, ticking. */
export function SinceText({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return null;
  const m = Math.max(0, Math.floor((now - new Date(at).getTime()) / 60_000));
  return <span>{m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`}</span>;
}
