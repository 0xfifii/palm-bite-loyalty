import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadBusiness, loadCommunity } from "@/lib/loyalty/queries";
import { CommunityCard } from "@/components/community/CommunityCard";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Community" };

export default async function CommunityPage() {
  const supabase = await createClient();
  const [items, business] = await Promise.all([loadCommunity(supabase), loadBusiness(supabase)]);
  const events = items.filter((i) => i.kind === "event");
  const clubs = items.filter((i) => i.kind === "club");
  return (
    <main className="px-5 pt-[calc(var(--safe-top)+1.25rem)]">
      <p className="text-sm font-semibold text-olive">palm way, our way</p>
      <h1 className="type-display mt-1 text-[2.6rem] text-olive-deep uppercase">Community</h1>
      <p className="mt-2 text-muted">More than coffee. Move, read and hang out with the Palm Bite family.</p>

      {events.length > 0 && (
        <section className="mt-6 space-y-3" aria-label="Events">
          {events.map((e) => (
            <CommunityCard key={e.id} item={e} />
          ))}
        </section>
      )}

      <section className="mt-6 space-y-3" aria-label="Clubs">
        {clubs.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-surface p-5 text-muted">Clubs are coming soon.</p>
        ) : (
          clubs.map((c) => <CommunityCard key={c.id} item={c} />)
        )}
      </section>

      <section className="mt-6 flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-soft text-olive-deep">
          <Icon name="pin" />
        </span>
        <div>
          <p className="font-semibold">Find us</p>
          <p className="text-sm text-muted">{business.store_address}</p>
        </div>
      </section>
    </main>
  );
}
