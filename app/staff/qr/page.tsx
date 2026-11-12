import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Visit QR" };

export default function StaffQrPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="type-heading text-[1.9rem]">Visit QR display</h1>
      <p className="mt-2 leading-relaxed text-muted">
        Open the display on the tablet or screen at the counter. Each code works for one Palm Fren and changes as soon as it&apos;s
        scanned (or after a minute). Names of guests who scanned appear beside the code: tap Approve to add their point. Keep the
        device plugged in and signed in with a Palm Staff account.
      </p>
      <div className="mt-6">
        <ButtonLink href="/display" variant="olive" size="lg" icon="qr" trailingArrow>
          Open the display
        </ButtonLink>
      </div>
      <div className="mt-8 rounded-[var(--radius-card)] bg-surface p-5 text-sm leading-relaxed text-muted">
        <p className="font-semibold text-ink">If a customer can&apos;t scan</p>
        <p className="mt-1">Use Check in to add their point by name or phone number. Please only do this when the guest is here in person.</p>
      </div>
    </div>
  );
}
