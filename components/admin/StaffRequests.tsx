import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/ui/Button";
import { decideStaffRequest } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/format";

/** People who signed up as Palm Staff and are waiting for an admin. */
export async function StaffRequests({ timeZone }: { timeZone: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, staff_requested_at")
    .eq("staff_request", "pending")
    .order("staff_requested_at", { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted">No staff requests right now.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-semibold">{r.full_name}</p>
            <p className="text-xs text-muted">
              {r.email}
              {r.phone ? `, ${r.phone}` : ""}, asked {formatDateTime(r.staff_requested_at, timeZone)}
            </p>
          </div>
          <div className="flex gap-2">
            <ActionForm action={decideStaffRequest} className="contents">
              <input type="hidden" name="userId" value={r.id} />
              <input type="hidden" name="decision" value="approve" />
              <SubmitButton variant="olive" size="sm" pendingLabel="...">
                Approve
              </SubmitButton>
            </ActionForm>
            <ActionForm action={decideStaffRequest} className="contents">
              <input type="hidden" name="userId" value={r.id} />
              <input type="hidden" name="decision" value="decline" />
              <SubmitButton variant="outline" size="sm" pendingLabel="...">
                Decline
              </SubmitButton>
            </ActionForm>
          </div>
        </li>
      ))}
    </ul>
  );
}
