"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Field";
import type { Drink } from "@/lib/types";
import { chooseRewardDrink } from "../actions";

type Choices = Record<string, string | string[]>;

export function ChooseDrink({ rewardId, drinks }: { rewardId: string; drinks: Drink[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(drinks[0]?.id ?? null);
  const [choices, setChoices] = useState<Choices>({});
  const [step, setStep] = useState<"choose" | "confirm" | "done">("choose");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; drinkName: string } | null>(null);
  const [pending, start] = useTransition();
  const drink = drinks.find((d) => d.id === selectedId) ?? null;

  function pick(id: string) {
    setSelectedId(id);
    setChoices({});
    setError(null);
  }

  function toggle(group: string, option: string, multi: boolean) {
    setChoices((prev) => {
      if (!multi) {
        if (prev[group] === option) {
          const next = { ...prev };
          delete next[group];
          return next;
        }
        return { ...prev, [group]: option };
      }
      const current = Array.isArray(prev[group]) ? (prev[group] as string[]) : [];
      const nextList = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      const next = { ...prev };
      if (nextList.length) next[group] = nextList;
      else delete next[group];
      return next;
    });
  }

  function confirm() {
    if (!drink) return;
    setError(null);
    start(async () => {
      const res = await chooseRewardDrink({ rewardId, drinkId: drink.id, customizations: choices });
      if (res.error) {
        setError(res.error);
        setStep("choose");
        return;
      }
      setDone({ reference: res.reference!, drinkName: res.drinkName! });
      setStep("done");
      router.refresh();
    });
  }

  if (drinks.length === 0) {
    return (
      <main className="px-5 pt-[calc(var(--safe-top)+1.5rem)]">
        <BackLink />
        <p className="mt-8 rounded-[var(--radius-card)] bg-surface p-5 text-muted">
          No reward drinks are available right now. Please ask a team member, your reward is safe.
        </p>
      </main>
    );
  }

  if (step === "done" && done) {
    return (
      <main className="flex min-h-[calc(100dvh-7rem)] flex-col px-5 pt-[calc(var(--safe-top)+1.5rem)] text-center">
        <div className="flex flex-1 flex-col items-center justify-center">
          <span className="grid size-20 place-items-center rounded-full bg-peach text-olive-deep">
            <Icon name="check" className="size-10" />
          </span>
          <h1 className="type-heading mt-6 text-[1.8rem]">Your {done.drinkName} is reserved</h1>
          <p className="mt-2 max-w-xs text-muted">Show this code at the counter. A team member will confirm it and make your drink.</p>
          <p className="type-display tabular mt-6 text-[2.8rem] tracking-wide text-olive-deep">{done.reference}</p>
        </div>
        <ButtonLink href="/rewards" variant="dark" size="lg" full>
          Show my code
        </ButtonLink>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[calc(100dvh-7rem)] flex-col bg-cream-deep">
      {/* Hero: faded name behind the drink, after the reference design */}
      <section className="relative h-[19rem] overflow-hidden px-5 pt-[calc(var(--safe-top)+1.25rem)]">
        <BackLink />
        {drink && (
          <>
            <p
              aria-hidden="true"
              className="type-display pointer-events-none absolute inset-x-0 top-16 px-4 text-center text-[3.4rem] leading-[0.88] text-ink/[0.07] uppercase"
            >
              {drink.name.replace(/^Sample\s+/i, "")}
            </p>
            <div key={drink.id} className="animate-rise absolute inset-x-0 top-12 mx-auto h-60 w-44">
              <DrinkImage name={drink.name} imageUrl={drink.image_url} accent={drink.accent_color} art={drink.art} id={drink.id} priority />
            </div>
          </>
        )}
      </section>

      <section className="animate-sheet-up relative z-10 flex flex-1 flex-col rounded-t-[var(--radius-sheet)] bg-surface px-5 pt-6 pb-6">
        {step === "choose" ? (
          <>
            <div className="flex items-baseline justify-between">
              <h1 className="type-heading text-2xl">Choose your drink</h1>
              <span className="text-sm font-semibold text-olive-deep">Free</span>
            </div>

            {error && (
              <div className="mt-4">
                <Notice tone="error">{error}</Notice>
              </div>
            )}

            <ul className="no-scrollbar -mx-5 mt-4 flex gap-2.5 overflow-x-auto px-5 pb-1" aria-label="Eligible drinks">
              {drinks.map((d) => (
                <li key={d.id} className="shrink-0">
                  <button
                    onClick={() => pick(d.id)}
                    aria-pressed={selectedId === d.id}
                    className={`flex w-28 flex-col items-center rounded-2xl border p-2.5 text-center transition-colors ${
                      selectedId === d.id ? "border-olive-deep bg-sage-mist" : "border-line hover:border-ink/30"
                    }`}
                  >
                    <span className="h-20 w-14">
                      <DrinkImage name="" imageUrl={d.image_url} accent={d.accent_color} art={d.art} id={`${d.id}-t`} />
                    </span>
                    <span className="mt-1.5 line-clamp-2 text-xs leading-tight font-medium">{d.name}</span>
                  </button>
                </li>
              ))}
            </ul>

            {drink && drink.customization.length > 0 && (
              <div className="mt-6 divide-y divide-line">
                <h2 className="pb-3 text-lg font-semibold">Customize</h2>
                {drink.customization.map((g) => (
                  <div key={g.name} role="group" aria-labelledby={`group-${g.name}`} className="py-4">
                    <p id={`group-${g.name}`} className="mb-3 text-sm font-semibold">
                      {g.name}
                      {g.multi && <span className="ml-1 font-normal text-muted">(choose any)</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.options.map((o) => {
                        const value = choices[g.name];
                        const on = Array.isArray(value) ? value.includes(o) : value === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(g.name, o, Boolean(g.multi))}
                            className={`h-10 rounded-full border px-4 text-sm transition-colors ${
                              on ? "border-cream-deep bg-cream-deep font-semibold text-ink" : "border-line bg-surface hover:border-ink/30"
                            }`}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {drink?.is_sample && (
              <p className="mt-4">
                <Badge tone="peach">Sample drink</Badge>
              </p>
            )}

            <div className="mt-auto pt-6">
              <Button variant="dark" size="lg" full onClick={() => setStep("confirm")} disabled={!drink}>
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="type-heading text-2xl">Confirm your free drink</h1>
            <div className="mt-5 rounded-2xl bg-sage-mist p-4">
              <p className="font-semibold">{drink?.name}</p>
              {Object.keys(choices).length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {Object.entries(choices).map(([k, v]) => (
                    <li key={k}>
                      {k}: {Array.isArray(v) ? v.join(", ") : v}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">Made the standard way.</p>
              )}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              You&apos;ll get a code to show at the counter. Your card resets to zero once a team member confirms your drink has been served.
            </p>
            <div className="mt-auto flex flex-col gap-3 pt-6">
              <Button variant="dark" size="lg" full onClick={confirm} disabled={pending} aria-busy={pending}>
                {pending ? "Reserving..." : "Reserve my drink"}
              </Button>
              <Button variant="ghost" size="lg" full onClick={() => setStep("choose")} disabled={pending}>
                Go back
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/rewards" aria-label="Back to rewards" className="relative z-10 grid size-11 place-items-center rounded-full bg-surface/80 shadow-soft">
      <Icon name="back" />
    </Link>
  );
}
