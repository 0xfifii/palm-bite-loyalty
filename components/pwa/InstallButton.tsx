"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { Mark } from "@/components/brand/Logo";
import {
  canPromptSnapshot,
  isInstalledSnapshot,
  platformSnapshot,
  promptInstall,
  subscribe,
  type InstallPlatform,
} from "@/lib/pwa/install";

const noop = () => () => undefined;

/**
 * "Download the app" button. Uses the browser's install prompt where it
 * exists (Android, desktop Chrome and Edge) and shows step-by-step help
 * everywhere else (iPhone). Hidden once the app is installed.
 */
export function InstallButton({
  variant = "light",
  label = "Download the app",
  className = "",
}: {
  variant?: "light" | "dark" | "outline";
  label?: string;
  className?: string;
}) {
  const installed = useSyncExternalStore(subscribe, isInstalledSnapshot, () => false);
  const canPrompt = useSyncExternalStore(subscribe, canPromptSnapshot, () => false);
  const platform = useSyncExternalStore(noop, platformSnapshot, () => "desktop" as InstallPlatform);
  const [open, setOpen] = useState(false);

  if (installed) return null;

  const styles = {
    light: "bg-peach text-olive-night hover:bg-peach-deep",
    dark: "bg-ink text-cream hover:bg-olive-night",
    outline: "border border-ink/15 bg-surface text-ink hover:border-ink/35",
  }[variant];

  async function onClick() {
    if (canPrompt) {
      const done = await promptInstall();
      if (!done) setOpen(true);
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold transition-colors active:scale-[0.98] ${styles} ${className}`}
      >
        <Icon name="install" className="size-5" />
        {label}
      </button>
      {open && <InstallSheet platform={platform} onClose={() => setOpen(false)} />}
    </>
  );
}

function InstallSheet({ platform, onClose }: { platform: InstallPlatform; onClose: () => void }) {
  const steps: Record<InstallPlatform, { title: string; steps: React.ReactNode[] }> = {
    "ios-safari": {
      title: "Add Palm Bite to your iPhone",
      steps: [
        <>Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow pointing up).</>,
        <>Scroll down and tap <strong>Add to Home Screen</strong>.</>,
        <>Tap <strong>Add</strong>. The Palm Bite icon appears on your home screen.</>,
      ],
    },
    "ios-other": {
      title: "Open in Safari first",
      steps: [
        <>On iPhone, apps can only be added from <strong>Safari</strong>. Copy this page&apos;s address.</>,
        <>Open <strong>Safari</strong> and paste the address.</>,
        <>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</>,
      ],
    },
    android: {
      title: "Add Palm Bite to your phone",
      steps: [
        <>Tap the <strong>three dots</strong> at the top right of Chrome.</>,
        <>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</>,
        <>Tap <strong>Install</strong>. The Palm Bite icon appears with your other apps.</>,
      ],
    },
    desktop: {
      title: "Install Palm Bite on this computer",
      steps: [
        <>In Chrome or Edge, click the <strong>install icon</strong> at the right end of the address bar.</>,
        <>Or open the browser menu and choose <strong>Install Palm Bite Loyalty</strong>.</>,
        <>On a phone, open this site in Chrome (Android) or Safari (iPhone) for the best experience.</>,
      ],
    },
  };
  const s = steps[platform];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={onClose}>
      <div
        className="animate-sheet-up w-full max-w-md rounded-t-[var(--radius-sheet)] bg-surface p-6 pb-[calc(var(--safe-bottom)+1.5rem)] text-left text-ink sm:rounded-[var(--radius-sheet)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-olive text-peach">
            <Mark height={30} label="" />
          </span>
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-ink/5">
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <h2 id="install-title" className="type-heading mt-4 text-2xl">
          {s.title}
        </h2>
        <ol className="mt-5 space-y-4">
          {s.steps.map((step, i) => (
            <li key={i} className="flex gap-3 leading-relaxed">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-peach font-bold text-olive-night">{i + 1}</span>
              <span className="pt-1">{step}</span>
            </li>
          ))}
        </ol>
        <button onClick={onClose} className="mt-6 h-12 w-full rounded-full bg-ink font-semibold text-cream">
          Got it
        </button>
      </div>
    </div>
  );
}
