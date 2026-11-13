import Link from "next/link";
import { getSession } from "@/lib/auth";
import { BottomNav } from "@/components/customer/BottomNav";
import { Wordmark } from "@/components/brand/Logo";

export const dynamic = "force-dynamic";

/**
 * Menu and Community are open to everyone (people scanning the poster can
 * browse before joining). Signed-in Palm Frens get the usual bottom bar.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  const signedIn = Boolean(user && profile?.status === "active");
  return (
    <div className="min-h-dvh bg-sage-soft">
      <div className={`mx-auto min-h-dvh w-full max-w-md bg-cream md:shadow-lift ${signedIn ? "pb-[calc(var(--safe-bottom)+7rem)]" : "pb-28"}`}>
        {!signedIn && (
          <header className="sticky top-0 z-30 flex items-center justify-between bg-olive px-5 pt-[calc(var(--safe-top)+0.75rem)] pb-3 text-cream">
            <Link href="/" aria-label="Palm Bite home" className="text-peach">
              <Wordmark height={24} />
            </Link>
            <nav className="flex items-center gap-2 text-sm font-semibold">
              <Link href="/menu" className="rounded-full px-3 py-2 hover:bg-cream/10">
                Menu
              </Link>
              <Link href="/community" className="rounded-full px-3 py-2 hover:bg-cream/10">
                Community
              </Link>
              <Link href="/join" className="rounded-full bg-peach px-4 py-2 text-olive-night">
                Join
              </Link>
            </nav>
          </header>
        )}
        {children}
      </div>
      {signedIn && <BottomNav />}
    </div>
  );
}
