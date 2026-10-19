import { BottomNav } from "@/components/customer/BottomNav";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-dvh bg-sage-soft">
      <div className="mx-auto min-h-dvh w-full max-w-md bg-cream pb-[calc(var(--safe-bottom)+7rem)] md:shadow-lift">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
