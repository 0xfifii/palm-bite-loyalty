import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { StaffShell } from "@/components/staff/StaffShell";


/** Private screens stay out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["staff", "admin"], "/staff");
  return (
    <StaffShell isAdmin={profile.role === "admin"} name={profile.full_name}>
      {children}
    </StaffShell>
  );
}
