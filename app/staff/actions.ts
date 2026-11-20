"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { actionMessage } from "@/lib/loyalty/codes";
import type { Order, RpcResult } from "@/lib/types";
import { customerUpdate } from "@/lib/order/status";
import { notifyUser } from "@/lib/notify/push";

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

export async function decideVisit(requestId: string, approve: boolean): Promise<Result<{ name: string; points?: number; rewardUnlocked?: boolean }>> {
  const { supabase } = await staff();
  const id = z.uuid().safeParse(requestId);
  if (!id.success) return { ok: false, error: actionMessage("REQUEST_NOT_FOUND") };
  const { data, error } = await supabase.rpc("staff_decide_visit", { p_request: id.data, p_approve: approve });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  const name = String(r.customer_name ?? "Palm Fren");
  if (r.code === "POINT_AWARDED") {
    const account = r.account as { points: number } | undefined;
    revalidatePath("/admin");
    return { ok: true, data: { name, points: account?.points, rewardUnlocked: r.reward_unlocked === true } };
  }
  if (r.code === "VISIT_DECLINED") return { ok: true, data: { name }, message: `Declined ${name}'s visit.` };
  const messages: Record<string, string> = {
    ALREADY_COLLECTED_TODAY: `${name} already collected today's point.`,
    REWARD_PENDING_REDEMPTION: `${name} has a free drink waiting. Redeem it first.`,
    ACCOUNT_SUSPENDED: `${name}'s account is suspended.`,
    REQUEST_EXPIRED: "This request timed out. Ask the guest to scan the new code.",
  };
  return { ok: false, error: messages[r.code] ?? actionMessage(r.code), code: r.code };
}

const ORDER_MESSAGES: Record<string, string> = {
  ORDER_CLOSED: "This order is already finished.",
  REASON_REQUIRED: "Choose a reason for cancelling.",
  INVALID_ETA: "Choose a ready time between 5 and 45 minutes.",
  ORDER_NOT_FOUND: "Order not found.",
};

export async function updateOrderStatus(orderId: string, status: string, reason?: string | null, eta?: number | null): Promise<Result> {
  const { supabase } = await staff();
  const id = z.uuid().safeParse(orderId);
  const st = z.enum(["confirmed", "preparing", "packaging", "ready", "on_the_way", "completed", "cancelled"]).safeParse(status);
  const rs = z.string().trim().max(160).nullable().optional().safeParse(reason ?? null);
  const et = z.number().int().min(5).max(45).nullable().optional().safeParse(eta ?? null);
  if (!id.success || !st.success || !rs.success || !et.success) return { ok: false, error: "Invalid request." };
  const { data, error } = await supabase.rpc("staff_set_order_status", {
    p_order: id.data,
    p_status: st.data,
    p_reason: rs.data || null,
    p_eta: et.data ?? null,
  });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  if (r.code === "NOT_IN_CHARGE") return { ok: false, error: `${r.in_charge ?? "Another team member"} is in charge of this order.` };
  if (r.code !== "OK") return { ok: false, error: ORDER_MESSAGES[r.code] ?? actionMessage(r.code) };
  const { data: o } = await supabase.from("orders").select("fulfilment, eta_minutes, accepted_by_name").eq("id", id.data).single();
  const msg = customerUpdate(st.data, (o?.fulfilment ?? "pickup") as Order["fulfilment"], String(r.reference), {
    eta: o?.eta_minutes ?? null,
    reason: rs.data || null,
    by: o?.accepted_by_name ?? null,
  });
  if (msg && typeof r.customer_id === "string") {
    const customer = r.customer_id;
    after(() => notifyUser(customer, { ...msg, url: "/orders", tag: `order-${r.reference}` }));
  }
  revalidatePath("/staff/orders");
  revalidatePath("/admin/orders");
  revalidatePath("/orders");
  return { ok: true };
}

/** The person in charge changes the ready time. */
export async function setOrderEta(orderId: string, minutes: number): Promise<Result> {
  const { supabase } = await staff();
  const id = z.uuid().safeParse(orderId);
  const m = z.number().int().min(5).max(45).safeParse(minutes);
  if (!id.success || !m.success) return { ok: false, error: "Choose a ready time between 5 and 45 minutes." };
  const { data, error } = await supabase.rpc("set_order_eta", { p_order: id.data, p_eta: m.data });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  if (r.code === "NOT_IN_CHARGE") return { ok: false, error: `${r.in_charge ?? "Another team member"} is in charge of this order.` };
  if (r.code !== "OK") return { ok: false, error: ORDER_MESSAGES[r.code] ?? actionMessage(r.code) };
  if (typeof r.customer_id === "string") {
    const customer = r.customer_id;
    after(() => notifyUser(customer, { title: `New ready time for ${r.reference}`, body: `Your order will be ready in about ${m.data} minutes.`, url: "/orders", tag: `order-${r.reference}` }));
  }
  revalidatePath("/staff/orders");
  revalidatePath("/admin/orders");
  revalidatePath("/orders");
  return { ok: true };
}

const staffOrderSchema = z.object({
  customerId: z.uuid().nullable(),
  walkInName: z.string().trim().max(80).default(""),
  items: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(50) })).min(1).max(40),
  fulfilment: z.enum(["pickup", "dine_in", "delivery"]),
  note: z.string().trim().max(500).default(""),
  address: z.string().trim().max(300).default(""),
  contact: z.string().trim().max(30).default(""),
  paid: z.boolean(),
  eta: z.number().int().min(5).max(45).nullable(),
});

/** Staff place an order for a customer at the counter or on the phone. */
export async function staffPlaceOrder(input: unknown): Promise<Result<{ reference: string; total: number }>> {
  const { supabase } = await staff();
  const p = staffOrderSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the order and try again." };
  const d = p.data;
  const { data, error } = await supabase.rpc("staff_place_order", {
    p_customer: d.customerId,
    p_walk_in_name: d.walkInName || null,
    p_items: d.items,
    p_fulfilment: d.fulfilment,
    p_note: d.note,
    p_address: d.fulfilment === "delivery" ? d.address : null,
    p_contact: d.contact || null,
    p_paid: d.paid,
    p_eta: d.eta,
  });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  const messages: Record<string, string> = {
    CUSTOMER_REQUIRED: "Choose a customer or type a name for a walk in.",
    CUSTOMER_NOT_FOUND: "That customer account isn't active.",
    ADDRESS_REQUIRED: "Add the delivery address.",
    CONTACT_REQUIRED: "Add a phone number for the rider.",
    INVALID_CONTACT: "Check the phone number.",
    ITEM_UNAVAILABLE: "One item is no longer available.",
    EMPTY_ORDER: "Add at least one item.",
    INVALID_ETA: "Choose a ready time between 5 and 45 minutes.",
  };
  if (r.code !== "ORDER_PLACED") return { ok: false, error: messages[r.code] ?? actionMessage(r.code) };
  if (d.customerId) {
    const customer = d.customerId;
    after(() =>
      notifyUser(customer, {
        title: `Order ${r.reference} placed for you`,
        body: `Palm Bite placed your order.${d.eta ? ` Ready in about ${d.eta} minutes.` : ""} Track it in the app.`,
        url: "/orders",
        tag: `order-${r.reference}`,
      }),
    );
  }
  revalidatePath("/staff/orders");
  revalidatePath("/admin/orders");
  return { ok: true, data: { reference: String(r.reference), total: Number(r.total) }, message: `Order ${r.reference} placed. You're in charge of it.` };
}

/** Staff mark an order as paid (after checking the transfer) or undo it. */
export async function setOrderPayment(orderId: string, paid: boolean): Promise<Result> {
  const { supabase } = await staff();
  const id = z.uuid().safeParse(orderId);
  if (!id.success) return { ok: false, error: "Invalid request." };
  const { data, error } = await supabase.rpc("set_order_payment", { p_order: id.data, p_paid: Boolean(paid) });
  if (error) return { ok: false, error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  if (r.code !== "OK") return { ok: false, error: actionMessage(r.code) };
  if (paid && typeof r.customer_id === "string") {
    const customer = r.customer_id;
    after(() => notifyUser(customer, { title: `Payment received for ${r.reference}`, body: "Thank you! Your payment has been confirmed.", url: "/orders", tag: `order-${r.reference}` }));
  }
  revalidatePath("/staff/orders");
  revalidatePath("/admin/orders");
  revalidatePath("/orders");
  return { ok: true };
}
