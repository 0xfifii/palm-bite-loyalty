import { naira } from "@/lib/format";
import type { OrderLine } from "@/lib/types";

export const FULFILMENT_LABELS = { pickup: "Pick up", dine_in: "Dine in", delivery: "Delivery" } as const;
export type Fulfilment = keyof typeof FULFILMENT_LABELS;

/** The WhatsApp message a Palm Fren sends to Palm Bite. */
export function orderMessage(o: {
  reference: string;
  name: string;
  phone: string | null;
  items: OrderLine[];
  total: number;
  fulfilment: Fulfilment;
  note: string | null;
  address?: string | null;
  contact?: string | null;
  deliveryFee?: number;
}): string {
  const lines = [
    `Hello Palm Bite! New order ${o.reference}`,
    "",
    ...o.items.map((i) => `${i.qty} x ${i.name}  ${naira(i.line_total)}`),
    "",
    ...(o.deliveryFee ? [`Delivery fee: ${naira(o.deliveryFee)}`] : []),
    `Total: ${naira(o.total)}`,
    `${FULFILMENT_LABELS[o.fulfilment]}`,
    `Name: ${o.name}${o.phone ? `  (${o.phone})` : ""}`,
  ];
  if (o.address) lines.push(`Deliver to: ${o.address}`);
  if (o.contact) lines.push(`Contact: ${o.contact}`);
  if (o.note) lines.push(`Note: ${o.note}`);
  return lines.join("\n");
}

/** Prefilled chat when a WhatsApp number is set; otherwise the business's message link. */
export function whatsappUrl(settings: { whatsapp_number: string | null; order_link: string }, text: string): { url: string; prefilled: boolean } {
  if (settings.whatsapp_number) {
    return { url: `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(text)}`, prefilled: true };
  }
  return { url: settings.order_link, prefilled: false };
}
