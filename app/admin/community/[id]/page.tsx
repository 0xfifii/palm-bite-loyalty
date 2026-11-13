import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { Field, TextArea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";
import { deleteCommunity, saveCommunity } from "@/app/admin/actions";
import type { CommunityItem } from "@/lib/types";

export const metadata: Metadata = { title: "Edit community" };

const BLANK: CommunityItem = {
  id: "new", kind: "club", title: "", tagline: "", description: "", schedule: "", location: "Palm View, along UBA Gate",
  join_link: null, starts_at: null, icon: "fitness", is_active: true, sort_order: 100,
};

const select = "h-13 w-full rounded-2xl border border-line bg-surface px-3";

function toLagosInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

export default async function EditCommunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { supabase } = await requireRole(["admin"], "/admin/community");
  let item = BLANK;
  if (id !== "new") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const { data } = await supabase.from("community_items").select("*").eq("id", id).maybeSingle<CommunityItem>();
    if (!data) notFound();
    item = data;
  }
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/community" className="font-semibold text-olive-deep">
          Community
        </Link>
      </p>
      <PageHeader title={id === "new" ? "Add club or event" : item.title} />
      {saved === "1" && <p className="mb-4 rounded-2xl bg-sage-soft px-4 py-3 text-sm">Saved.</p>}
      <div className="max-w-2xl rounded-[var(--radius-card)] bg-surface p-6">
        <ActionForm action={saveCommunity} className="space-y-5">
          <input type="hidden" name="id" value={item.id} />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="kind" className="mb-1.5 block text-sm font-medium">Type</label>
              <select id="kind" name="kind" defaultValue={item.kind} className={select}>
                <option value="club">Club</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div>
              <label htmlFor="icon" className="mb-1.5 block text-sm font-medium">Illustration</label>
              <select id="icon" name="icon" defaultValue={item.icon} className={select}>
                <option value="fitness">Fitness</option>
                <option value="book">Books</option>
                <option value="spark">Event / celebration</option>
              </select>
            </div>
          </div>
          <Field label="Title" name="title" required maxLength={80} defaultValue={item.title} />
          <Field label="Short line" name="tagline" maxLength={120} defaultValue={item.tagline} hint="For example: Move together, refuel together." />
          <TextArea label="Description" name="description" rows={4} maxLength={1000} defaultValue={item.description} hint="What happens, who it's for, what to bring." />
          <Field label="When" name="schedule" maxLength={160} defaultValue={item.schedule} hint="For example: Every Saturday, 7am" />
          <Field label="Where" name="location" maxLength={160} defaultValue={item.location} />
          <Field label="Join link" name="join_link" type="url" placeholder="https://chat.whatsapp.com/..." defaultValue={item.join_link ?? ""} hint="A WhatsApp group, form or Instagram link. Must start with https://" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Event date and time (events only)" name="starts_at" type="datetime-local" defaultValue={toLagosInput(item.starts_at)} hint="Lagos time. Events hide the day after." />
            <Field label="Order on page" name="sort_order" type="number" min={0} max={10000} defaultValue={item.sort_order} />
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="is_active" defaultChecked={item.is_active} className="size-5 accent-olive" />
            Show in the app
          </label>
          <SubmitButton variant="olive" pendingLabel="Saving...">
            Save
          </SubmitButton>
        </ActionForm>
        {item.id !== "new" && (
          <ActionForm action={deleteCommunity} className="mt-6 border-t border-line pt-5">
            <input type="hidden" name="id" value={item.id} />
            <SubmitButton variant="ghost" size="sm" pendingLabel="Deleting...">
              Delete this {item.kind}
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </>
  );
}
