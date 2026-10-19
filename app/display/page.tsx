import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { QrDisplay } from "@/components/qr/QrDisplay";

export const metadata: Metadata = { title: "Visit QR display" };
export const dynamic = "force-dynamic";

export default async function DisplayPage() {
  const { profile } = await requireRole(["staff", "admin"], "/display");
  return <QrDisplay exitHref={profile.role === "admin" ? "/admin/qr" : "/staff/qr"} />;
}
