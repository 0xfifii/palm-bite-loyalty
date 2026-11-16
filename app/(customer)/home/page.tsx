import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadBusiness, loadCommunity, loadCustomer, loadDrinks } from "@/lib/loyalty/queries";
import { CommunityCard } from "@/components/community/CommunityCard";
import { AboutPalmBite } from "@/components/community/AboutPalmBite";
import { SocialLinks } from "@/components/community/SocialLinks";
import { LoyaltyCard } from "@/components/customer/LoyaltyCard";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import { ButtonLink } from "@/components/ui/Button";
import { RewardStatusBadge, Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Field";
import { Mark } from "@/components/brand/Logo";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { firstName, formatDate, formatTime, formatVisitDate, initials, naira } from "@/lib/format";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { supabase, user, profile } = await requireUser("/home");
  const sp = await searchParams;
  const [data, drinks, community, business] = await Promise.all([
    loadCustomer(supabase, user.id, { visits: 5, rewards: 5 }),
    loadDrinks(supabase),
    loadCommunity(supabase),
    loadBusiness(supabase),
  ]);
  const picks = drinks.filter((d) => d.item_type === "pick");
  const gems = drinks.filter((d) => d.category === "Gems");
  const showcase = (picks.length ? [...picks, ...gems] : drinks).slice(0, 8);
  const tz = data.timezone;
  const points = data.account?.current_points ?? 0;
  const cycle = data.account?.cycle_number ?? 1;
  const history = data.rewards.filter((r) => r.status === "redeemed" || r.status === "cancelled").slice(0, 3);

  return (
    <main className="px-5 pt-[calc(var(--safe-top)+1.25rem)]">
      <header className="flex items-center justify-between">
        <Mark height={34} className="text-olive" />
        <Link
          href="/profile"
          aria-label="Your profile"
          className="grid size-11 place-items-center rounded-full bg-surface text-sm font-bold text-olive-deep shadow-soft"
        >
          {initials(profile.full_name)}
        </Link>
      </header>

      <div className="mt-6">
        <h1 className="type-heading text-[1.85rem]">Welcome back, {firstName(profile.full_name)}!</h1>
        <p className="mt-1 text-muted">Your next Palm Bite treat is getting closer.</p>
        <p className="mt-1 text-sm font-semibold text-olive">pour. sip. stay a while.</p>
      </div>

      {profile.staff_request === "pending" && profile.role === "customer" && (
        <div className="mt-4">
          <Notice tone="info">Your Palm Staff request is waiting for an admin to approve it. You can use the app as a Palm Fren meanwhile.</Notice>
        </div>
      )}

      {sp.password === "updated" && (
        <div className="mt-4">
          <Notice tone="success">Your password has been updated.</Notice>
        </div>
      )}

      <div className="mt-6">
        <LoyaltyCard points={points} cycle={cycle} openReward={data.openReward} pendingRedemption={data.pendingRedemption} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {!data.openReward ? (
          <ButtonLink href="/scan" variant="dark" size="lg" icon="scan" full>
            Scan &amp; Earn
          </ButtonLink>
        ) : (
          <ButtonLink href="/rewards" variant="dark" size="lg" icon="gift" full>
            My reward
          </ButtonLink>
        )}
        <ButtonLink href="/menu" variant="peach" size="lg" icon="bag" full>
          Order now
        </ButtonLink>
      </div>

      <InstallBanner />

      <section className="mt-10" aria-labelledby="menu-heading">
        <div className="flex items-end justify-between">
          <h2 id="menu-heading" className="type-heading text-xl">
            Our picks
          </h2>
          <Link href="/menu" className="text-sm font-semibold text-olive-deep underline underline-offset-4">
            Full menu
          </Link>
        </div>
        {drinks.length === 0 ? (
          <p className="mt-3 text-muted">The menu is being prepared. Check back soon.</p>
        ) : (
          <ul className="no-scrollbar -mx-5 mt-4 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2">
            {showcase.map((d) => (
              <li key={d.id} className="w-36 shrink-0 snap-start">
                <Link href="/menu" className="block">
                  <div className={`h-44 overflow-hidden rounded-[var(--radius-card)] ${d.image_url ? "" : "p-2"}`} style={{ background: `${d.accent_color}33` }}>
                    <DrinkImage name={d.name} imageUrl={d.image_url} accent={d.accent_color} art={d.art} id={d.id} />
                  </div>
                  <p className="mt-2 text-sm leading-snug font-semibold">{d.name}</p>
                  {d.price_naira !== null && <p className="tabular text-sm text-muted">{naira(d.price_naira)}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-9">
        <AboutPalmBite address={business.store_address} />
      </div>

      <section className="mt-9" aria-labelledby="community-heading">
        <div className="flex items-end justify-between">
          <h2 id="community-heading" className="type-heading text-xl">
            The Palm community
          </h2>
          <Link href="/community" className="text-sm font-semibold text-olive-deep underline underline-offset-4">
            See all
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">Follow us, join the chat and come to our clubs.</p>
        <div className="mt-4">
          <SocialLinks whatsappChat={business.order_link} />
        </div>
        {community.length > 0 && (
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2">
            {community.map((c) => (
              <Link key={c.id} href="/community" className="block w-72 shrink-0 snap-start">
                <CommunityCard item={c} compact />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-9" aria-labelledby="visits-heading">
        <div className="flex items-end justify-between">
          <h2 id="visits-heading" className="type-heading text-xl">
            Recent visits
          </h2>
          {data.visits.length > 0 && (
            <Link href="/rewards#visits" className="text-sm font-semibold text-olive-deep underline underline-offset-4">
              Full history
            </Link>
          )}
        </div>
        {data.visits.length === 0 ? (
          <div className="mt-3 rounded-[var(--radius-card)] bg-surface p-5 text-muted">
            No visits yet. Scan the code at Palm Bite on your next visit to collect your first point.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] bg-surface px-5">
            {data.visits.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="font-medium">{formatVisitDate(v.visit_date)}</p>
                  <p className="text-sm text-muted">
                    {formatTime(v.created_at, tz)} {v.method === "staff_assisted" ? "with a team member" : "by QR scan"}
                  </p>
                </div>
                <Badge tone="sage">+1 point</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-9" aria-labelledby="rewards-heading">
          <h2 id="rewards-heading" className="type-heading text-xl">
            Reward history
          </h2>
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] bg-surface px-5">
            {history.map((r) => {
              const drink = data.redemptions.find((d) => d.reward_id === r.id && d.status === "completed");
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3.5">
                  <div>
                    <p className="font-medium">{drink?.drink_name ?? `Card ${r.cycle_number} reward`}</p>
                    <p className="text-sm text-muted">{formatDate(r.redeemed_at ?? r.cancelled_at ?? r.earned_at, tz)}</p>
                  </div>
                  <RewardStatusBadge status={r.status} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
