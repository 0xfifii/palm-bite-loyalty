import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { updateBusiness, updateSettings } from "@/app/admin/actions";
import { Field, TextArea } from "@/components/ui/Field";
import { loadBusiness } from "@/lib/loyalty/queries";
import { StaffRequests } from "@/components/admin/StaffRequests";

export const metadata: Metadata = { title: "Settings" };

const COMMON_ZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Europe/London", "America/New_York", "UTC"];

export default async function SettingsPage() {
  const { supabase } = await requireRole(["admin"], "/admin/settings");
  const [business, { data: settings }, { data: team }] = await Promise.all([
    loadBusiness(supabase),
    supabase.from("app_settings").select("business_timezone, qr_ttl_seconds, updated_at").single(),
    supabase.from("profiles").select("id, full_name, email, role, status").in("role", ["staff", "admin"]).order("role").order("full_name"),
  ]);
  const zones = Intl.supportedValuesOf("timeZone");
  const current = settings?.business_timezone ?? "Africa/Lagos";

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Business day and visit codes">
          <ActionForm action={updateSettings} className="space-y-5">
            <div>
              <label htmlFor="timezone" className="mb-1.5 block text-sm font-medium">
                Business timezone
              </label>
              <select id="timezone" name="timezone" defaultValue={current} className="h-12 w-full rounded-xl border border-line bg-surface px-3">
                <optgroup label="Common">
                  {COMMON_ZONES.map((z) => (
                    <option key={`c-${z}`} value={z}>
                      {z}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="All timezones">
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-1.5 text-sm text-muted">A customer can earn one point per calendar day in this timezone. The day changes at midnight local time.</p>
            </div>
            <div>
              <label htmlFor="ttl" className="mb-1.5 block text-sm font-medium">
                QR code lifetime (seconds)
              </label>
              <input id="ttl" name="ttl" type="number" min={30} max={300} step={5} defaultValue={settings?.qr_ttl_seconds ?? 60} className="h-12 w-full rounded-xl border border-line px-3" />
              <p className="mt-1.5 text-sm text-muted">Between 30 and 300. Shorter is safer; 60 seconds suits most counters.</p>
            </div>
            <SubmitButton variant="olive" pendingLabel="Saving...">
              Save settings
            </SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Ordering and contact">
          <ActionForm action={updateBusiness} className="space-y-4">
            <Field label="WhatsApp order link" name="order_link" type="url" required defaultValue={business.order_link} hint="Where Send order on WhatsApp goes." />
            <Field
              label="WhatsApp number (optional)"
              name="whatsapp_number"
              inputMode="tel"
              placeholder="2348031234567"
              defaultValue={business.whatsapp_number ?? ""}
              hint="With country code, no +. When set, orders open WhatsApp with the message already typed in."
            />
            <Field label="Address" name="store_address" defaultValue={business.store_address} />
            <TextArea
              label="Payment instructions (optional)"
              name="payment_note"
              rows={3}
              maxLength={500}
              defaultValue={business.payment_note ?? ""}
              hint="Shown after an order is placed. For example your bank name, account name and account number."
            />
            <SubmitButton variant="olive" pendingLabel="Saving...">
              Save details
            </SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Team access">
          <h3 className="mb-2 font-semibold">Palm Staff requests</h3>
          <div className="mb-6">
            <StaffRequests timeZone={current} />
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            New team members sign up as Palm Staff and appear above for approval. You can also change anyone&apos;s role from their profile in Customers.
          </p>
          <Table head={["Name", "Role", "Status"]} empty="No staff accounts yet.">
            {(team ?? []).map((t) => (
              <tr key={t.id}>
                <Td>
                  <Link href={`/admin/customers/${t.id}`} className="font-semibold text-olive-deep hover:underline">
                    {t.full_name}
                  </Link>
                  <p className="text-xs text-muted">{t.email}</p>
                </Td>
                <Td>
                  <Badge tone="olive">{t.role === "admin" ? "Administrator" : "Staff"}</Badge>
                </Td>
                <Td>{t.status === "active" ? <Badge tone="sage">Active</Badge> : <Badge tone="danger">Suspended</Badge>}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
