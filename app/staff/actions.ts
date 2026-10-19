"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { actionMessage } from "@/lib/loyalty/codes";
import type { RpcResult } from "@/lib/types";

const referenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => (v.startsWith("PB-") ? v : `PB-${v.replace(/^PB/, "")}`))
  .pipe(z.string().regex(/^PB-[0-9A-Z]{6}$/));

export type RedemptionDetails = {
  id: string;
  reference: string;
  status: "pending" | "completed" | "cancelled";
  drink_name: string;
  customizations: Record<string, string | string[]>;
  requested_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  reward_reference: string;
  reward_status: string;
  cycle_number: number;
  ownership_ok: boolean;
  customer_name: string;
  customer_phone_last4: string;
  account_status: string;
  current_points: number;
};

type Result<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; code?: string };

async function staff() {
  return requireRole(["staff", "admin"], "/staff");
}

export async function lookupRedemption(reference: string): Promise<Result<RedemptionDetails>> {
  const { supabase } = await staff();
  const ref = referenceSchema.safeParse(reference);
  if (!ref.success) return { ok: false, error: "Enter a code like PB-7K3Q9X." };
  const { data, error } = await supabase.rpc("lookup_redemption", { p_reference: ref.data });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  if (r.code !== "OK") return { ok: false, error: actionMessage(r.code), code: r.code };
  return { ok: true, data: r.redemption as RedemptionDetails };
}

export async function completeRedemption(reference: string): Promise<Result<{ drink_name: string; completed_at: string }>> {
  const { supabase } = await staff();
  const ref = referenceSchema.safeParse(reference);
  if (!ref.success) return { ok: false, error: "Invalid code." };
  const { data, error } = await supabase.rpc("complete_redemption", { p_reference: ref.data });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  if (r.code !== "REDEMPTION_COMPLETED") return { ok: false, error: actionMessage(r.code), code: r.code };
  revalidatePath("/staff");
  revalidatePath("/admin/rewards");
  return { ok: true, data: { drink_name: String(r.drink_name), completed_at: String(r.completed_at) } };
}

export async function cancelRedemption(reference: string, reason: string): Promise<Result> {
  const { supabase } = await staff();
  const ref = referenceSchema.safeParse(reference);
  if (!ref.success) return { ok: false, error: "Invalid code." };
  const why = z.string().trim().min(3, "Please add a short reason.").max(280).safeParse(reason);
  if (!why.success) return { ok: false, error: why.error.issues[0].message };
  const { data, error } = await supabase.rpc("cancel_redemption", { p_reference: ref.data, p_reason: why.data });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  if (r.code !== "REDEMPTION_CANCELLED") return { ok: false, error: actionMessage(r.code) };
  revalidatePath("/staff");
  revalidatePath("/admin/rewards");
  return { ok: true, message: "Request cancelled. The customer's reward is available again." };
}

export type CustomerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string;
  role: string;
  status: string;
  current_points: number;
  cycle_number: number;
  total_visits: number;
  rewards_redeemed: number;
  open_reward_status: string | null;
  last_visit_at: string | null;
  created_at: string;
  total_count: number;
};

export async function searchCustomers(query: string): Promise<Result<CustomerRow[]>> {
  const { supabase } = await staff();
  const q = z.string().max(80).safeParse(query ?? "");
  if (!q.success) return { ok: false, error: "Search is too long." };
  const { data, error } = await supabase.rpc("admin_search_customers", { p_query: q.data, p_limit: 20, p_offset: 0 });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  return { ok: true, data: (data ?? []) as CustomerRow[] };
}

export async function staffCheckIn(customerId: string, note: string): Promise<Result<{ points: number }>> {
  const { supabase } = await staff();
  const id = z.uuid().safeParse(customerId);
  if (!id.success) return { ok: false, error: "Customer not found." };
  const n = z.string().trim().max(280).safeParse(note ?? "");
  if (!n.success) return { ok: false, error: "Note is too long." };
  const { data, error } = await supabase.rpc("staff_check_in", { p_customer: id.data, p_note: n.data || null });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  if (r.code === "POINT_AWARDED") {
    const account = r.account as { points: number };
    return { ok: true, data: { points: account.points }, message: r.reward_unlocked ? "Point added. This customer has unlocked a free drink." : "Point added." };
  }
  const messages: Record<string, string> = {
    ALREADY_COLLECTED_TODAY: "This customer already collected today's point.",
    REWARD_PENDING_REDEMPTION: "This customer has a free drink waiting. Redeem it before adding points.",
    ACCOUNT_SUSPENDED: "This account is suspended.",
  };
  return { ok: false, error: messages[r.code] ?? actionMessage(r.code), code: r.code };
}
