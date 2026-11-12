import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { VisitApprovals } from "@/components/staff/VisitApprovals";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Approve visits" };

export default async function StaffApprovalsPage() {
  await requireRole(["staff", "admin"], "/staff");
  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <section>
        <h1 className="type-heading text-[1.9rem]">Approve visits</h1>
        <p className="mt-1 mb-5 text-muted">Check the name on the guest&apos;s phone, then tap Approve to add their point.</p>
        <VisitApprovals />
      </section>
      <aside className="rounded-[var(--radius-card)] bg-surface p-5">
        <h2 className="type-heading text-lg">Counter screen</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          The counter screen shows the code to scan and this approval list side by side. Each code works for one Palm Fren, and a new one appears as soon as it&apos;s used.
        </p>
        <div className="mt-4">
          <ButtonLink href="/display" variant="dark" icon="qr">
            Open counter screen
          </ButtonLink>
        </div>
      </aside>
    </div>
  );
}
