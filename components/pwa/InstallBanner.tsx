"use client";

import { useState, useSyncExternalStore } from "react";
import { InstallButton } from "./InstallButton";
import { Icon } from "@/components/ui/Icon";
import { isInstalledSnapshot, subscribe } from "@/lib/pwa/install";

const KEY = "pb-install-banner-dismissed";
const readDismissed = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Home-screen nudge for Palm Frens using the app in a browser tab. */
export function InstallBanner() {
  const installed = useSyncExternalStore(subscribe, isInstalledSnapshot, () => true);
  const storedDismissed = useSyncExternalStore(() => () => undefined, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (installed || storedDismissed || dismissed) return null;

  return (
    <section className="relative mt-6 rounded-[var(--radius-card)] bg-olive p-5 text-cream" aria-label="Download the app">
      <button
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // ignore
          }
        }}
        aria-label="Hide"
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-cream/12"
      >
        <Icon name="close" className="size-4" />
      </button>
      <p className="type-heading pr-10 text-lg">Get the Palm Bite app</p>
      <p className="mt-1 text-sm text-cream/80">Add it to your home screen so your card is one tap away at the counter.</p>
      <InstallButton variant="light" className="mt-4" />
    </section>
  );
}
