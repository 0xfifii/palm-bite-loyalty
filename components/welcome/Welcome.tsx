import { Wordmark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import { Splash } from "./Splash";

export function Welcome() {
  return (
    <main className="min-h-dvh bg-sage-soft md:grid md:place-items-center md:p-8">
      <Splash />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-olive md:min-h-[860px] md:rounded-[2.75rem] md:shadow-lift">
        {/* Hero */}
        <section className="relative flex flex-1 flex-col items-center px-6 pt-[calc(var(--safe-top)+1.75rem)]">
          <div className="text-peach">
            <Wordmark height={30} />
          </div>

          <span className="mt-6 rounded-full bg-peach px-3 py-1.5 text-xs font-semibold text-olive-night">Loyalty club</span>

          <h2
            aria-hidden="true"
            className="type-display pointer-events-none mt-4 text-center text-[4.4rem] leading-[0.86] text-cream uppercase sm:text-[5rem]"
          >
            Good
            <br />
            taste
          </h2>

          <div className="relative -mt-14 flex h-[19rem] w-full max-w-[22rem] items-end justify-center" aria-hidden="true">
            <div className="absolute bottom-0 left-[6%] h-[17rem] w-[12rem] -rotate-[11deg] drop-shadow-[0_24px_30px_rgba(20,28,14,0.35)]">
              <DrinkImage name="" imageUrl={null} accent="#9DB27C" id="hero-left" />
            </div>
            <div className="absolute right-[6%] bottom-2 h-[17rem] w-[12rem] rotate-[10deg] drop-shadow-[0_24px_30px_rgba(20,28,14,0.35)]">
              <DrinkImage name="" imageUrl={null} accent="#E9B08F" id="hero-right" />
            </div>
          </div>
        </section>

        {/* Sheet */}
        <section className="relative z-10 -mt-6 rounded-t-[var(--radius-sheet)] bg-surface px-6 pt-8 pb-[calc(var(--safe-bottom)+1.75rem)] text-center">
          <h1 className="type-heading text-[2rem] text-ink">Good taste deserves rewards.</h1>
          <p className="mx-auto mt-3 max-w-[19rem] text-[1.02rem] leading-relaxed text-muted">
            Every visit brings you closer to your next Palm Bite favourite.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <ButtonLink href="/join" variant="dark" size="lg" trailingArrow full>
              Join the Club
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="lg" full>
              Welcome Back
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-muted">One visit a day earns one point. Fifteen points earns a free drink.</p>
        </section>
      </div>
    </main>
  );
}
