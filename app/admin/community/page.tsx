import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CommunityArt } from "@/components/community/CommunityArt";
import type { CommunityItem } from "@/lib/types";

export const metadata: Metadata = { title: "Community" };

export default async function AdminCommunityPage() {
  const { supabase } = await requireRole(["admin"], "/admin/community");
  const { data } = await supabase.from("community_items").select("*").order("sort_order");
  const items = (data ?? []) as CommunityItem[];
  return (
    <>
      <PageHeader
        title="Community"
        description="The Fitness Club, Book Club and events Palm Frens see in the app. Add when you meet and a join link (for example a WhatsApp group)."
        actions={
          <ButtonLink href="/admin/community/new" variant="olive" icon="plus">
            Add club or event
          </ButtonLink>
        }
      />
      <Panel>
        {items.length === 0 ? (
          <p className="text-muted">Nothing yet. Add your first club or event.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/community/${c.id}`} className="flex gap-4 rounded-2xl border border-line p-3 hover:border-olive">
                  <div className="h-16 w-24 shrink-0 rounded-xl bg-olive-deep p-1">
                    <CommunityArt icon={c.icon} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{c.title}</p>
                    <p className="truncate text-sm text-muted">{c.schedule || "No schedule yet"}</p>
                    <div className="mt-2 flex gap-1">
                      <Badge tone="sage">{c.kind === "club" ? "Club" : "Event"}</Badge>
                      {!c.is_active && <Badge tone="muted">Hidden</Badge>}
                      {!c.join_link && <Badge tone="peach">No join link</Badge>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
