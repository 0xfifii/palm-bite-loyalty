"use client";

import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./Icon";

/**
 * A "Back" button for screens that are not a main tab. Goes to the previous
 * screen, or to `fallback` when the screen was opened directly (for example
 * from a notification or a shared link).
 */
export function BackButton({ roots, fallback, tone = "light" }: { roots: string[]; fallback: string; tone?: "light" | "dark" }) {
  const path = usePathname();
  const router = useRouter();
  if (roots.includes(path)) return null;
  const goBack = () => {
    const cameFromHere = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin);
    if (window.history.length > 1 && cameFromHere) router.back();
    else router.push(fallback);
  };
  return (
    <button
      type="button"
      onClick={goBack}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full pr-4 pl-2.5 text-sm font-semibold active:scale-95 ${
        tone === "dark" ? "bg-cream/12 text-cream hover:bg-cream/20" : "bg-surface text-ink shadow-soft hover:bg-white"
      }`}
    >
      <Icon name="arrow" className="size-4 rotate-180" /> Back
    </button>
  );
}
