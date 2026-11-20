import type { Metadata } from "next";
import Link from "next/link";
import { BottomNav } from "@/components/customer/BottomNav";
import { Icon } from "@/components/ui/Icon";
import { BackButton } from "@/components/ui/BackButton";
import { OrderAlerts } from "@/components/notify/OrderAlerts";
import { requireUser } from "@/lib/auth";


/** Private screens stay out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const team = profile.role !== "customer";
  return (
    <div className="min-h-dvh bg-sage-soft">
      <div className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl bg-cream pb-[calc(var(--safe-bottom)+7rem)] md:shadow-lift">
        {team && (
          <Link
            href={profile.role === "admin" ? "/admin" : "/staff"}
            className="flex items-center justify-center gap-2 bg-ink px-4 pt-[calc(var(--safe-top)+0.5rem)] pb-2 text-sm font-semibold text-cream"
          >
            You are in the Palm Fren app. Back to the {profile.role === "admin" ? "admin" : "staff"} app <Icon name="arrow" className="size-4" />
          </Link>
        )}
        <div className="sticky top-0 z-30 px-4 pt-[calc(var(--safe-top)+0.5rem)] empty:hidden md:px-8">
          <BackButton roots={["/home"]} fallback="/home" />
        </div>
        {children}
      </div>
      <OrderAlerts mode="fren" />
      <BottomNav />
    </div>
  );
}
