import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isReportKind, type ReportKind } from "./csv";

const dateSchema = z.iso.date().optional().or(z.literal("").transform(() => undefined));

export function parseReportParams(kind: string, from?: string | null, to?: string | null) {
  if (!isReportKind(kind)) return null;
  const f = dateSchema.safeParse(from ?? undefined);
  const t = dateSchema.safeParse(to ?? undefined);
  if (!f.success || !t.success) return null;
  return { kind: kind as ReportKind, from: f.data ?? null, to: t.data ?? null };
}

/** Runs a report as the signed-in user; the database refuses non-admins. */
export async function fetchReport(kind: ReportKind, from: string | null, to: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report", { p_kind: kind, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Record<string, unknown>>;
}
