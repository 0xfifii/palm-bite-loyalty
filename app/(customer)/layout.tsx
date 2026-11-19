import type { Metadata } from "next";
import { BottomNav } from "@/components/customer/BottomNav";
import { BackButton } from "@/components/ui/BackButton";
import { OrderAlerts } from "@/components/notify/OrderAlerts";
import { requireUser } from "@/lib/auth";


/** Private screens stay out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-dvh bg-sage-soft">
      <div className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl bg-cream pb-[calc(var(--safe-bottom)+7rem)] md:shadow-lift">
        <div className="sticky top-0 z-30 px-4 pt-[calc(var(--safe-top)+0.5rem)] empty:hidden md:px-8">
          <BackButton roots={["/home", "/menu", "/scan", "/rewards", "/orders", "/profile"]} fallback="/home" />
        </div>
        {children}
      </div>
      <OrderAlerts mode="fren" />
      <BottomNav />
    </div>
  );
}
