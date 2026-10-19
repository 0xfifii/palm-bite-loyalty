import type { Metadata } from "next";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { loadCustomer } from "@/lib/loyalty/queries";
import { ButtonLink } from "@/components/ui/Button";
import { RewardStatusBadge, Badge } from "@/components/ui/Badge";
import { describeCustomizations, formatDate, formatDateTime, formatTime, formatVisitDate } from "@/lib/format";
import { pad2 } from "@/lib/loyalty/progress";
import { ChangeDrinkButton } from "./ChangeDrinkButton";

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const { supabase, user } = await requireUser("/rewards");
  const data = await loadCustomer(supabase, user.id, { visits: 120, rewards: 100 });
  const tz = data.timezone;
  const account = data.account;
  const completed = data.rewards.filter((r) => r.status === "redeemed");
  const past = data.rewards.filter((r) => r.status === "redeemed" || r.status === "cancelled");
  const pending = data.pendingRedemption;
  const referenceQr = pending
    ? await QRCode.toString(pending.reference, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1D2119", light: "#FFFFFF" } })
    : null;

  return (
    <main className="px-5 pt-[calc(var(--safe-top)+1.5rem)]">
      <h1 className="type-display text-[3rem] text-olive-deep uppercase">Rewards</h1>

      <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[var(--radius-card)] bg-olive-deep px-2 py-4 text-cream">
          <dt className="text-xs text-cream/70">Points</dt>
          <dd className="type-heading tabular mt-1 text-2xl">{pad2(account?.current_points ?? 0)}</dd>
        </div>
        <div className="rounded-[var(--radius-card)] bg-surface px-2 py-4">
          <dt className="text-xs text-muted">Current card</dt>
          <dd className="type-heading tabular mt-1 text-2xl">{account?.cycle_number ?? 1}</dd>
        </div>
        <div className="rounded-[var(--radius-card)] bg-surface px-2 py-4">
          <dt className="text-xs text-muted">Drinks earned</dt>
          <dd className="type-heading tabular mt-1 text-2xl">{completed.length}</dd>
        </div>
      </dl>

      <section className="mt-8" aria-labelledby="open-heading">
        <h2 id="open-heading" className="type-heading text-xl">
          Your reward
        </h2>
        {!data.openReward ? (
          <div className="mt-3 rounded-[var(--radius-card)] bg-surface p-5">
            <p className="text-muted">
              {15 - (account?.current_points ?? 0)} more {15 - (account?.current_points ?? 0) === 1 ? "visit" : "visits"} until your free drink.
            </p>
            <div className="mt-4">
              <ButtonLink href="/scan" variant="dark" icon="scan">
                Scan &amp; Earn
              </ButtonLink>
            </div>
          </div>
        ) : pending ? (
          <div className="mt-3 overflow-hidden rounded-[var(--radius-sheet)] bg-surface">
            <div className="flex items-center justify-between bg-peach px-5 py-4 text-olive-night">
              <p className="font-semibold">{pending.drink_name}</p>
              <RewardStatusBadge status="pending" />
            </div>
            <div className="p-5 text-center">
              <p className="text-muted">Show this to a team member at the counter.</p>
              {referenceQr && (
                <div
                  className="mx-auto mt-4 w-44 [&>svg]:h-auto [&>svg]:w-full"
                  role="img"
                  aria-label={`QR code for redemption ${pending.reference}`}
                  dangerouslySetInnerHTML={{ __html: referenceQr }}
                />
              )}
              <p className="type-display tabular mt-3 text-[2.2rem] tracking-wide">{pending.reference}</p>
              {Object.keys(pending.customizations ?? {}).length > 0 && (
                <p className="mt-2 text-sm text-muted">{describeCustomizations(pending.customizations)}</p>
              )}
              <p className="mt-1 text-xs text-muted">Requested {formatDateTime(pending.requested_at, tz)}</p>
              <div className="mt-5">
                <ChangeDrinkButton reference={pending.reference} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-[var(--radius-sheet)] bg-peach p-5 text-olive-night">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Free drink, card {data.openReward.cycle_number}</p>
              <RewardStatusBadge status="available" />
            </div>
            <p className="type-heading mt-4 text-2xl">Your next drink is on us!</p>
            <p className="mt-1 text-olive-night/75">Choose your favourite eligible drink.</p>
            <div className="mt-5">
              <ButtonLink href={`/rewards/${data.openReward.id}`} variant="olive" trailingArrow>
                Choose My Drink
              </ButtonLink>
            </div>
          </div>
        )}
      </section>

      <section className="mt-9" aria-labelledby="history-heading">
        <h2 id="history-heading" className="type-heading text-xl">
          Past rewards
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 rounded-[var(--radius-card)] bg-surface p-5 text-muted">Your redeemed drinks will appear here.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {past.map((r) => {
              const d = data.redemptions.find((x) => x.reward_id === r.id && x.status === "completed");
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-surface p-4">
                  <div>
                    <p className="font-semibold">{d?.drink_name ?? "Free drink"}</p>
                    <p className="text-sm text-muted">
                      Card {r.cycle_number}, {formatDate(r.redeemed_at ?? r.cancelled_at, tz)}
                    </p>
                  </div>
                  <RewardStatusBadge status={r.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-9 scroll-mt-6" id="visits" aria-labelledby="visit-history-heading">
        <h2 id="visit-history-heading" className="type-heading text-xl">
          Visit history
        </h2>
        {data.visits.length === 0 ? (
          <p className="mt-3 rounded-[var(--radius-card)] bg-surface p-5 text-muted">Your verified visits will appear here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] bg-surface px-5">
            {data.visits.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="font-medium">{formatVisitDate(v.visit_date)}</p>
                  <p className="text-sm text-muted">
                    {formatTime(v.created_at, tz)}, card {v.cycle_number}
                  </p>
                </div>
                <Badge tone={v.method === "qr" ? "sage" : "peach"}>{v.method === "qr" ? "QR scan" : "Team check-in"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
