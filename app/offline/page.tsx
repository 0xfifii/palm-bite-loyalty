import { Mark } from "@/components/brand/Logo";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-olive px-6 text-center text-cream">
      <div>
        <Mark height={64} className="text-peach" />
        <h1 className="type-heading mt-8 text-[1.8rem]">You&apos;re offline</h1>
        <p className="mx-auto mt-3 max-w-xs leading-relaxed text-cream/80">
          Your card, points and rewards need a connection so they are always accurate. Reconnect and try again.
        </p>
        <a href="/home" className="mt-8 inline-flex h-12 items-center rounded-full bg-cream px-6 font-semibold text-olive-night">
          Try again
        </a>
      </div>
    </main>
  );
}
