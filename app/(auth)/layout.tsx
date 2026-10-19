import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-sage-soft md:grid md:place-items-center md:p-8">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-olive md:min-h-[820px] md:overflow-hidden md:rounded-[2.75rem] md:shadow-lift">
        <header className="flex items-center justify-center px-6 pt-[calc(var(--safe-top)+1.75rem)] pb-10">
          <Link href="/" aria-label="Palm Bite Loyalty home" className="text-peach">
            <Wordmark height={30} />
          </Link>
        </header>
        <div className="flex-1 rounded-t-[var(--radius-sheet)] bg-surface px-6 pt-8 pb-[calc(var(--safe-bottom)+2rem)]">
          {children}
        </div>
      </div>
    </main>
  );
}
