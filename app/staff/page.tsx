import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { RedeemDesk } from "@/components/staff/RedeemDesk";
import { PendingRedemptions } from "@/components/staff/PendingRedemptions";

export const metadata: Metadata = { title: "Redeem rewards" };

export default async function StaffRedeemPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  await requireRole(["staff", "admin"], "/staff");
  const { ref } = await searchParams;
  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <section>
        <h1 className="type-heading text-[1.9rem]">Redeem a free drink</h1>
        <p className="mt-1 mb-5 text-muted">Check the code, make the drink, then confirm it was served.</p>
        <RedeemDesk key={ref ?? ""} initialReference={ref && /^PB-[0-9A-Z]{6}$/.test(ref) ? ref : ""} />
      </section>
      <PendingRedemptions basePath="/staff" />
    </div>
  );
}
