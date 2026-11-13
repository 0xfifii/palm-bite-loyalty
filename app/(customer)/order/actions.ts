"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { loadBusiness } from "@/lib/loyalty/queries";
import { orderMessage, whatsappUrl } from "@/lib/order/message";
import type { OrderLine, RpcResult } from "@/lib/types";

const schema = z.object({
  items: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(50) })).min(1).max(40),
  fulfilment: z.enum(["pickup", "dine_in", "delivery"]),
  note: z.string().trim().max(500).optional().default(""),
});

export type PlaceOrderResult =
  | { ok: true; reference: string; items: OrderLine[]; total: number; message: string; url: string; prefilled: boolean; paymentNote: string | null }
  | { ok: false; error: string; unavailable?: string };

const ERRORS: Record<string, string> = {
  EMPTY_ORDER: "Your order is empty.",
  INVALID_ORDER: "Something in your order isn't right. Please check it and try again.",
  ITEM_UNAVAILABLE: "One item is no longer available. It has been removed from your order.",
  RATE_LIMITED: "You've placed several orders just now. Please wait a few minutes.",
  ACCOUNT_SUSPENDED: "Your account is paused. Please speak to Palm Bite.",
};

/** Records the order (prices from the menu) and prepares the WhatsApp message. */
export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const { supabase, profile } = await requireUser("/order");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERRORS.INVALID_ORDER };

  const { data, error } = await supabase.rpc("place_order", {
    p_items: parsed.data.items,
    p_fulfilment: parsed.data.fulfilment,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, error: "We couldn't place your order. Please try again." };
  const r = data as RpcResult;
  if (r.code !== "ORDER_PLACED") {
    return { ok: false, error: ERRORS[r.code] ?? ERRORS.INVALID_ORDER, unavailable: typeof r.item_id === "string" ? r.item_id : undefined };
  }

  const business = await loadBusiness(supabase);
  const items = r.items as OrderLine[];
  const total = Number(r.total);
  const message = orderMessage({
    reference: String(r.reference),
    name: profile.full_name,
    phone: profile.phone,
    items,
    total,
    fulfilment: parsed.data.fulfilment,
    note: parsed.data.note || null,
  });
  const { url, prefilled } = whatsappUrl(business, message);
  revalidatePath("/profile");
  return { ok: true, reference: String(r.reference), items, total, message, url, prefilled, paymentNote: business.payment_note };
}

export async function cancelMyOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser("/profile");
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: "Order not found." };
  const { data, error } = await supabase.rpc("set_order_status", { p_order: orderId, p_status: "cancelled" });
  if (error || (data as RpcResult)?.code !== "OK") return { ok: false, error: "This order can no longer be cancelled here. Please message Palm Bite." };
  revalidatePath("/profile");
  return { ok: true };
}
