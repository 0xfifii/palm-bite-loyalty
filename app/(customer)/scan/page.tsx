import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ScanExperience } from "./ScanExperience";

export const metadata: Metadata = { title: "Scan & Earn" };

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { profile } = await requireUser("/scan");
  const { t } = await searchParams;
  const initialToken = typeof t === "string" && t.startsWith("PB1.") && t.length < 1000 ? t : null;
  return <ScanExperience initialToken={initialToken} memberName={profile.full_name} memberPhone={profile.phone} />;
}
