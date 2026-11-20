"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { loadBusiness } from "@/lib/loyalty/queries";
import { naira } from "@/lib/format";
import { orderMessage, whatsappUrl, FULFILMENT_LABELS } from "@/lib/order/message";
import { notifyStaff } from "@/lib/notify/push";
import type { OrderLine, RpcResult } from "@/lib/types";

const schema = z.object({
  items: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(50) })).min(1).max(40),
  fulfilment: z.enum(["pickup", "dine_in", "delivery"]),
  note: z.string().trim().max(500).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  contact: z.string().trim().max(30).optional().default(""),
});

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      reference: string;
      items: OrderLine[];
      subtotal: number;
      deliveryFee: number;
      total: number;
      message: string;
      url: string;
      prefilled: boolean;
      paymentNote: string | null;
    }
  | { ok: false; error: string; unavailable?: string; field?: "address" | "contact" };

const ERRORS: Record<string, string> = {
  EMPTY_ORDER: "Your order is empty.",
  INVALID_ORDER: "Something in your order isn't right. Please check it and try again.",
  ITEM_UNAVAILABLE: "One item is no longer available. It has been removed from your order.",
  RATE_LIMITED: "You've placed several orders just now. Please wait a few minutes.",
  ACCOUNT_SUSPENDED: "Your account is paused. Please speak to Palm Bite.",
  ADDRESS_REQUIRED: "Please add the address we should deliver to.",
  CONTACT_REQUIRED: "Please add a phone number the rider can call.",
  INVALID_CONTACT: "Please check the phone number. Use digits only, for example 0803 123 4567.",
};

/** Records the order (prices from the menu) and tells the Palm Bite team. */
export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const { supabase, profile } = await requireUser("/order");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERRORS.INVALID_ORDER };
  const d = parsed.data;

  const { data, error } = await supabase.rpc("place_order", {
    p_items: d.items,
    p_fulfilment: d.fulfilment,
    p_note: d.note,
    p_address: d.fulfilment === "delivery" ? d.address : null,
    p_contact: d.contact || null,
  });
  if (error) return { ok: false, error: "We couldn't place your order. Please try again." };
  const r = data as RpcResult;
  if (r.code !== "ORDER_PLACED") {
    return {
      ok: false,
      error: ERRORS[r.code] ?? ERRORS.INVALID_ORDER,
      unavailable: typeof r.item_id === "string" ? r.item_id : undefined,
      field: r.code === "ADDRESS_REQUIRED" ? "address" : r.code === "CONTACT_REQUIRED" || r.code === "INVALID_CONTACT" ? "contact" : undefined,
    };
  }

  const business = await loadBusiness(supabase);
  const items = r.items as OrderLine[];
  const total = Number(r.total);
  const deliveryFee = Number(r.delivery_fee ?? 0);
  const subtotal = Number(r.subtotal ?? total - deliveryFee);
  const reference = String(r.reference);
  const message = orderMessage({
    reference,
    name: profile.full_name,
    phone: d.contact || profile.phone,
    items,
    total,
    fulfilment: d.fulfilment,
    note: d.note || null,
    address: d.fulfilment === "delivery" ? d.address : null,
    deliveryFee,
  });
  const { url, prefilled } = whatsappUrl(business, message);

  const count = items.reduce((s, i) => s + i.qty, 0);
  after(() =>
    notifyStaff({
      title: `New order ${reference}`,
      body: `${profile.full_name}: ${count} ${count === 1 ? "item" : "items"}, ${naira(total)}, ${FULFILMENT_LABELS[d.fulfilment]}`,
      url: "/staff/orders",
      tag: `order-${reference}`,
    }),
  );
  revalidatePath("/orders");
  revalidatePath("/staff/orders");
  return { ok: true, orderId: String(r.order_id), reference, items, subtotal, deliveryFee, total, message, url, prefilled, paymentNote: business.payment_note };
}

const CUSTOMER_ERRORS: Record<string, string> = {
  ORDER_NOT_FOUND: "Order not found.",
  ORDER_LOCKED: "Orders can't be cancelled once sent. Please message Palm Bite.",
  ORDER_CLOSED: "This order is already finished.",
  RATE_LIMITED: "Palm Bite has just been told. Give the team a moment.",
  INVALID_INPUT: "That receipt couldn't be attached. Please try again.",
};

/** "Go ahead": the Palm Fren tells the team to start on the order. */
export async function goAhead(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, profile } = await requireUser("/orders");
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: "Order not found." };
  const { data, error } = await supabase.rpc("order_go_ahead", { p_order: orderId });
  const r = data as RpcResult | null;
  if (error || r?.code !== "OK") return { ok: false, error: CUSTOMER_ERRORS[r?.code ?? ""] ?? "Couldn't reach Palm Bite. Please try again." };
  after(() => notifyStaff({ title: `Go ahead on ${r.reference}`, body: `${profile.full_name} says go ahead with their order.`, url: "/staff/orders", tag: `order-${r.reference}` }));
  revalidatePath("/orders");
  revalidatePath("/staff/orders");
  return { ok: true };
}

/** Attaches an uploaded transfer receipt to the order and tells the team. */
export async function submitReceipt(orderId: string, path: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, profile } = await requireUser("/orders");
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: "Order not found." };
  const { data, error } = await supabase.rpc("submit_order_receipt", { p_order: orderId, p_path: String(path).slice(0, 200) });
  const r = data as RpcResult | null;
  if (error || r?.code !== "OK") return { ok: false, error: CUSTOMER_ERRORS[r?.code ?? ""] ?? "That receipt couldn't be attached. Please try again." };
  after(() => notifyStaff({ title: `Payment receipt for ${r.reference}`, body: `${profile.full_name} sent a transfer receipt. Check and confirm payment.`, url: "/staff/orders", tag: `order-${r.reference}` }));
  revalidatePath("/orders");
  revalidatePath("/staff/orders");
  return { ok: true };
}
