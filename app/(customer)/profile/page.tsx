import Link from "next/link";
import type { Metadata } from "next";
import { requireUser, homeFor } from "@/lib/auth";
import { loadCustomer } from "@/lib/loyalty/queries";
import { ProfileForm } from "./ProfileForm";
import { InstallGuide } from "@/components/pwa/InstallGuide";
import { Icon } from "@/components/ui/Icon";
import { formatDate, initials } from "@/lib/format";
import { signOutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { supabase, user, profile } = await requireUser("/profile");
  const data = await loadCustomer(supabase, user.id, { visits: 1, rewards: 100 });
  const a = data.account;

  return (
    <main className="px-5 pt-[calc(var(--safe-top)+1.5rem)]">
      <div className="flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-olive-deep text-xl font-bold text-peach">{initials(profile.full_name)}</span>
        <div>
          <h1 className="type-heading text-2xl">{profile.full_name}</h1>
          <p className="text-sm text-muted">Member since {formatDate(profile.created_at, data.timezone)}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
        {[
          ["Current points", a?.current_points ?? 0],
          ["Verified visits", a?.total_visits ?? 0],
          ["Drinks redeemed", a?.rewards_redeemed ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-card)] bg-surface px-2 py-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="type-heading tabular mt-1 text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      {profile.role !== "customer" && (
        <Link
          href={homeFor(profile.role)}
          className="mt-4 flex items-center justify-between rounded-[var(--radius-card)] bg-olive-deep p-4 font-semibold text-cream"
        >
          Open {profile.role === "admin" ? "admin dashboard" : "staff tools"}
          <Icon name="arrow" />
        </Link>
      )}

      <section className="mt-8 rounded-[var(--radius-card)] bg-surface p-5" aria-labelledby="details-heading">
        <h2 id="details-heading" className="type-heading mb-4 text-lg">
          Your details
        </h2>
        <ProfileForm fullName={profile.full_name} phone={profile.phone} email={profile.email} />
      </section>

      <nav className="mt-4 divide-y divide-line rounded-[var(--radius-card)] bg-surface px-5" aria-label="Your history">
        <Link href="/rewards#visits" className="flex items-center justify-between py-4 font-medium">
          Visit history <Icon name="arrow" className="size-4 text-muted" />
        </Link>
        <Link href="/rewards" className="flex items-center justify-between py-4 font-medium">
          Reward history <Icon name="arrow" className="size-4 text-muted" />
        </Link>
        <Link href="/forgot-password" className="flex items-center justify-between py-4 font-medium">
          Change password <Icon name="arrow" className="size-4 text-muted" />
        </Link>
      </nav>

      <section className="mt-4 rounded-[var(--radius-card)] bg-surface p-5" aria-labelledby="install-heading">
        <h2 id="install-heading" className="type-heading mb-2 text-lg">
          Get the app
        </h2>
        <InstallGuide />
      </section>

      <form action={signOutAction} className="mt-6">
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-ink/15 font-semibold hover:border-ink/35">
          <Icon name="logout" /> Sign out
        </button>
      </form>
    </main>
  );
}
