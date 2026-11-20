import type { Order, OrderStatus } from "@/lib/types";

export const ETA_CHOICES = [5, 10, 15, 20, 25, 30, 35, 40, 45] as const;
export const CANCEL_REASONS = ["Not available", "Out of stock", "Shop is closed", "Customer asked to cancel", "Payment not received"] as const;

/** What each status is called, for Palm Frens and staff. */
export function statusLabel(status: OrderStatus, fulfilment: Order["fulfilment"]): string {
  switch (status) {
    case "new":
      return "Sent";
    case "confirmed":
      return "Confirmed";
    case "preparing":
      return "Preparing";
    case "packaging":
      return fulfilment === "dine_in" ? "Plating" : "Packaging";
    case "ready":
      return fulfilment === "dine_in" ? "Ready to serve" : fulfilment === "delivery" ? "Ready" : "Ready for pick up";
    case "on_the_way":
      return "On its way";
    case "completed":
      return fulfilment === "dine_in" ? "Served" : "Received";
    case "cancelled":
      return "Cancelled";
  }
}

/** The steps a Palm Fren sees on the order tracker. */
export function trackerSteps(fulfilment: Order["fulfilment"]): OrderStatus[] {
  return fulfilment === "delivery"
    ? ["new", "confirmed", "preparing", "packaging", "on_the_way", "completed"]
    : ["new", "confirmed", "preparing", "packaging", "ready", "completed"];
}

/** The next move staff can make from each status. */
export function nextStep(status: OrderStatus, fulfilment: Order["fulfilment"]): { status: OrderStatus; label: string } | null {
  switch (status) {
    case "new":
      return { status: "confirmed", label: "Confirm and take charge" };
    case "confirmed":
      return { status: "preparing", label: "Preparing" };
    case "preparing":
      return { status: "packaging", label: fulfilment === "dine_in" ? "Plating" : "Packaging" };
    case "packaging":
      return fulfilment === "delivery" ? { status: "on_the_way", label: "On its way" } : { status: "ready", label: fulfilment === "dine_in" ? "Ready to serve" : "Ready for pick up" };
    case "ready":
      return fulfilment === "delivery" ? { status: "on_the_way", label: "On its way" } : { status: "completed", label: fulfilment === "dine_in" ? "Served" : "Received" };
    case "on_the_way":
      return { status: "completed", label: "Received" };
    default:
      return null;
  }
}

/** What the Palm Fren is told when their order moves. */
export function customerUpdate(
  status: OrderStatus,
  fulfilment: Order["fulfilment"],
  ref: string,
  extra: { eta?: number | null; reason?: string | null; by?: string | null } = {},
): { title: string; body: string } | null {
  switch (status) {
    case "confirmed":
      return {
        title: `Order ${ref} confirmed`,
        body: `${extra.by ? `${extra.by} is handling your order.` : "Palm Bite has your order."}${extra.eta ? ` Ready in about ${extra.eta} minutes.` : ""}`,
      };
    case "preparing":
      return { title: `We're preparing ${ref}`, body: "Your order is being made right now." };
    case "packaging":
      return { title: `${ref} is being packed`, body: fulfilment === "dine_in" ? "Almost ready to serve." : "Almost ready. We're packing it up." };
    case "ready":
      return { title: `${ref} is ready!`, body: fulfilment === "dine_in" ? "Your order is ready to serve." : "Come and pick it up at the counter." };
    case "on_the_way":
      return { title: `${ref} is on its way`, body: "Your delivery has left Palm Bite." };
    case "completed":
      return { title: fulfilment === "dine_in" ? `${ref} served` : `${ref} received`, body: "Enjoy, Palm Fren! Thank you for ordering." };
    case "cancelled":
      return { title: `Order ${ref} cancelled`, body: extra.reason ? `Reason: ${extra.reason}. Message Palm Bite if you have questions.` : "Message Palm Bite if you have any questions." };
    default:
      return null;
  }
}

export const OPEN_STATUSES: OrderStatus[] = ["new", "confirmed", "preparing", "packaging", "ready", "on_the_way"];
