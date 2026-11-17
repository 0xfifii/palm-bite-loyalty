import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadBusiness, loadCommunity, loadDrinks } from "@/lib/loyalty/queries";
import { CommunityCard } from "@/components/community/CommunityCard";
import { AboutPalmBite } from "@/components/community/AboutPalmBite";
import { SocialLinks } from "@/components/community/SocialLinks";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Mark } from "@/components/brand/Logo";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { firstName, initials, naira } from "@/lib/format";
import type { Drink } from "@/lib/types";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { supabase, profile } = await requireUser("/home");
  const sp = await searchParams;
  const [drinks, community, business] = await Promise.all([loadDrinks(supabase), loadCommunity(supabase), loadBusiness(supabase)]);
  const picks = drinks.filter((d) => d.item_type === "pick");
  const gems = drinks.filter((d) => d.category === "Gems");
  const merch = drinks.filter((d) => d.item_type === "merch");
  const showcase = (picks.length ? [...picks, ...gems] : drinks).slice(0, 8);

  return (
    <main className="px-5 md:px-8 pt-[calc(var(--safe-top)+1.25rem)]">
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

      {/* Hero */}
      <section className="relative mt-5 overflow-hidden rounded-[var(--radius-sheet)] bg-olive-night text-cream" aria-labelledby="hero-heading">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photos/melis.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_35%] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-olive-night via-olive-night/55 to-transparent" />
        <div className="relative flex min-h-[23rem] flex-col justify-end p-6 md:min-h-[26rem] md:p-10">
          <p className="text-sm font-semibold text-peach">pour. sip. stay a while.</p>
          <h1 id="hero-heading" className="type-display mt-2 text-[2.6rem] leading-[0.92] uppercase md:max-w-xl md:text-[3.6rem]">
            Hi {firstName(profile.full_name)}, welcome to Palm Bite
          </h1>
          <p className="mt-3 max-w-[18rem] text-cream/85">Signature Gems, fresh juice, Slab and pastries. Made the Palm way.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 md:max-w-md">
            <ButtonLink href="/menu" variant="peach" size="lg" icon="bag" full>
              Order now
            </ButtonLink>
            <ButtonLink href="/community" variant="light" size="lg" icon="people" full>
              Community
            </ButtonLink>
          </div>
        </div>
      </section>

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

      <InstallBanner />

      <section className="mt-9" aria-labelledby="menu-heading">
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
          <Shelf items={showcase} href="/menu" />
        )}
      </section>

      <div className="md:mt-9 md:grid md:grid-cols-2 md:items-start md:gap-6">
      <div className="mt-9 md:mt-0">
        <AboutPalmBite address={business.store_address} />
      </div>

      <section className="mt-9 md:mt-0" aria-labelledby="community-heading">
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
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 md:-mx-8 md:scroll-px-8 md:px-8">
            {community.map((c) => (
              <Link key={c.id} href="/community" className="block w-72 shrink-0 snap-start">
                <CommunityCard item={c} compact />
              </Link>
            ))}
          </div>
        )}
      </section>
      </div>

      {merch.length > 0 && (
        <section className="mt-9" aria-labelledby="merch-heading">
          <div className="flex items-end justify-between">
            <h2 id="merch-heading" className="type-heading text-xl">
              Merch 1.0
            </h2>
            <Link href="/menu?tab=merch" className="text-sm font-semibold text-olive-deep underline underline-offset-4">
              Shop merch
            </Link>
          </div>
          <Shelf items={merch} href="/menu?tab=merch" contain />
        </section>
      )}

      <section className="mt-9 flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-5" aria-label="Visit us">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-soft text-olive-deep">
          <Icon name="pin" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Visit Palm Bite</p>
          <p className="text-sm text-muted">{business.store_address}</p>
        </div>
        <a href={business.order_link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#1F8A4C] px-4 py-2 text-sm font-semibold text-white">
          WhatsApp
        </a>
      </section>
    </main>
  );
}

function Shelf({ items, href, contain = false }: { items: Drink[]; href: string; contain?: boolean }) {
  return (
    <ul className="no-scrollbar -mx-5 mt-4 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 md:-mx-8 md:scroll-px-8 md:px-8">
      {items.map((d) => (
        <li key={d.id} className="w-36 shrink-0 snap-start md:w-44">
          <Link href={href} className="block">
            <div
              className={`h-44 overflow-hidden md:h-52 rounded-[var(--radius-card)] ${d.image_url ? "" : "p-2"}`}
              style={{ background: contain && d.image_url ? "#ffffff" : `${d.accent_color === "#1D2119" ? "#A9B89A" : d.accent_color}33` }}
            >
              <DrinkImage name={d.name} imageUrl={d.image_url} accent={d.accent_color} art={d.art} id={d.id} fit={contain ? "contain" : "cover"} />
            </div>
            <p className="mt-2 text-sm leading-snug font-semibold">{d.name}</p>
            {d.price_naira !== null && <p className="tabular text-sm text-muted">{naira(d.price_naira)}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
