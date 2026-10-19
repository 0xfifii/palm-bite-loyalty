import { requireRole } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { signOutAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["admin"], "/admin");
  return (
    <AdminShell name={profile.full_name} signOut={signOutAction}>
      {children}
    </AdminShell>
  );
}
