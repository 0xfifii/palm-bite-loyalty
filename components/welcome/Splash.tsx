"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/Logo";

/**
 * Branded splash shown once per browser session on first open. It is purely
 * visual and never delays data: the welcome screen renders underneath.
 */
export function Splash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("pb-splash") === "1";
      sessionStorage.setItem("pb-splash", "1");
    } catch {
      // storage unavailable: show the splash, harmlessly
    }
    if (seen) {
      const t0 = setTimeout(() => setVisible(false), 0);
      return () => clearTimeout(t0);
    }
    const t1 = setTimeout(() => setLeaving(true), 950);
    const t2 = setTimeout(() => setVisible(false), 1350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-50 grid place-items-center bg-olive transition-opacity duration-400 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <div className="animate-splash-in text-peach">
        <Wordmark height={64} />
      </div>
    </div>
  );
}
