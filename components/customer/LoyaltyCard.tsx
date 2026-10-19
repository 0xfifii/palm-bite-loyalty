import { Wordmark, Mark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { cardState } from "@/lib/loyalty/progress";
import type { Redemption, Reward } from "@/lib/types";

type Props = {
  points: number;
  cycle: number;
  openReward: Reward | null;
  pendingRedemption: Redemption | null;
  /** Index of a stamp to animate (the one just earned). */
  highlight?: number;
};

export function LoyaltyCard({ points, cycle, openReward, pendingRedemption, highlight }: Props) {
  const state = cardState(points, Boolean(openReward));

  if (openReward) {
    return (
      <section aria-label="Loyalty card" className="relative overflow-hidden rounded-[var(--radius-sheet)] bg-peach p-6 text-olive-night shadow-lift">
        <div className="flex items-center justify-between">
          <Wordmark height={20} className="text-olive-deep" />
          <span className="text-xs font-semibold tracking-wide">Card {cycle} complete</span>
        </div>
        <div className="pointer-events-none absolute -right-6 -bottom-10 text-olive-deep/10" aria-hidden="true">
          <Mark height={210} />
        </div>
        {pendingRedemption ? (
          <div className="relative mt-8">
            <p className="type-heading text-[1.75rem] leading-tight">Your {pendingRedemption.drink_name} is waiting.</p>
            <p className="mt-2 text-olive-night/75">Show this code at the counter. A team member will confirm it.</p>
            <p className="type-display tabular mt-5 text-[2.6rem] tracking-wide" aria-label={`Redemption code ${pendingRedemption.reference.split("").join(" ")}`}>
              {pendingRedemption.reference}
            </p>
            <div className="mt-5">
              <ButtonLink href="/rewards" variant="olive" size="md">
                View my reward
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="relative mt-8">
            <p className="type-display text-[2.35rem] leading-[0.95] uppercase">Your next drink is on us!</p>
            <p className="mt-3 text-olive-night/75">Choose your favourite eligible drink.</p>
            <div className="mt-6">
              <ButtonLink href={`/rewards/${openReward.id}`} variant="olive" size="lg" trailingArrow>
                Choose My Drink
              </ButtonLink>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Loyalty card"
      className="relative overflow-hidden rounded-[var(--radius-sheet)] bg-olive-deep p-6 text-cream shadow-lift"
    >
      <div className="flex items-center justify-between">
        <p className="text-[0.8rem] font-semibold tracking-[0.14em] text-peach">PALM BITE REWARDS</p>
        <span className="text-xs text-cream/60">Card {cycle}</span>
      </div>

      <p className="type-display tabular mt-5 text-[2.9rem]" aria-label={`${state.points} of 15 visits`}>
        {state.label}
      </p>

      <ol className="mt-6 grid grid-cols-5 gap-x-3 gap-y-3.5" aria-hidden="true">
        {state.stamps.map((filled, i) => (
          <li key={i} className="grid aspect-square place-items-center">
            {filled ? (
              <span
                className={`stamp-bite grid size-full place-items-center rounded-full bg-peach text-olive-deep ${
                  highlight === i ? "animate-stamp-pop" : ""
                }`}
              >
                <Mark height={20} label="" />
              </span>
            ) : (
              <span className="grid size-full place-items-center rounded-full border-[1.5px] border-dashed border-cream/30 text-xs text-cream/35 tabular">
                {i + 1}
              </span>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-6 text-[0.95rem] text-cream/85">{state.summary}</p>
    </section>
  );
}
