import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { describeCustomizations, formatDateTime } from "@/lib/format";

type Row = {
  id: string;
  reference: string;
  drink_name: string;
  customizations: Record<string, string | string[]>;
  requested_at: string;
  profiles: { full_name: string } | null;
};

/** Pending redemption requests, newest first. Staff RLS allows reading these. */
export async function PendingRedemptions({ basePath }: { basePath: string }) {
  const supabase = await createClient();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase
      .from("redemptions")
      .select("id, reference, drink_name, customizations, requested_at, profiles!redemptions_customer_id_fkey(full_name)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(30),
    supabase.from("app_settings").select("business_timezone").single(),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const tz = settings?.business_timezone ?? "Africa/Lagos";

  return (
    <section aria-labelledby="pending-heading">
      <h2 id="pending-heading" className="type-heading text-xl">
        Waiting at the counter
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-card)] bg-surface p-5 text-muted">No drinks waiting. New requests appear here.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`${basePath}?ref=${r.reference}`}
                className="block rounded-[var(--radius-card)] bg-surface p-4 transition-colors hover:bg-sage-mist"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{r.drink_name}</p>
                  <p className="tabular text-sm font-semibold text-olive-deep">{r.reference}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {r.profiles?.full_name ?? "Customer"}, {formatDateTime(r.requested_at, tz)}
                </p>
                {Object.keys(r.customizations ?? {}).length > 0 && (
                  <p className="mt-1 text-sm">{describeCustomizations(r.customizations)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
