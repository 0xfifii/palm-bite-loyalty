"use client";

import { Mark } from "@/components/brand/Logo";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div>
        <Mark height={56} className="text-olive" />
        <h1 className="type-heading mt-8 text-[1.8rem]">Something went wrong</h1>
        <p className="mt-3 max-w-xs text-muted">Nothing on your card has changed. Check your connection and try again.</p>
        <button onClick={reset} className="mt-8 h-12 rounded-full bg-ink px-6 font-semibold text-cream">
          Try again
        </button>
      </div>
    </main>
  );
}
