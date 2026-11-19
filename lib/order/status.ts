import type { Order, OrderStatus } from "@/lib/types";

/** What each status is called, for Palm Frens and staff. */
export function statusLabel(status: OrderStatus, fulfilment: Order["fulfilment"]): string {
  switch (status) {
    case "new":
      return "Sent";
    case "confirmed":
      return "Confirmed";
    case "preparing":
      return "Preparing";
    case "ready":
      return fulfilment === "dine_in" ? "Ready to serve" : "Ready for pick up";
    case "on_the_way":
      return "On its way";
    case "completed":
      return fulfilment === "delivery" ? "Delivered" : fulfilment === "dine_in" ? "Served" : "Collected";
    case "cancelled":
      return "Cancelled";
  }
}

/** The steps a Palm Fren sees on the order tracker. */
export function trackerSteps(fulfilment: Order["fulfilment"]): OrderStatus[] {
  return fulfilment === "delivery"
    ? ["new", "confirmed", "preparing", "on_the_way", "completed"]
    : ["new", "confirmed", "preparing", "ready", "completed"];
}

/** The next move staff can make from each status. */
export function nextStep(status: OrderStatus, fulfilment: Order["fulfilment"]): { status: OrderStatus; label: string } | null {
  switch (status) {
    case "new":
      return { status: "confirmed", label: "Confirm order" };
    case "confirmed":
      return { status: "preparing", label: "Preparing" };
    case "preparing":
      return fulfilment === "delivery" ? { status: "on_the_way", label: "On its way" } : { status: "ready", label: fulfilment === "dine_in" ? "Ready to serve" : "Ready for pick up" };
    case "ready":
      return { status: "completed", label: fulfilment === "dine_in" ? "Served" : "Collected" };
    case "on_the_way":
      return { status: "completed", label: "Delivered" };
    default:
      return null;
  }
}

/** What the Palm Fren is told when their order moves. */
export function customerUpdate(status: OrderStatus, fulfilment: Order["fulfilment"], ref: string): { title: string; body: string } | null {
  switch (status) {
    case "confirmed":
      return { title: `Order ${ref} confirmed`, body: "Palm Bite has your order. We'll start on it shortly." };
    case "preparing":
      return { title: `We're preparing ${ref}`, body: "Your order is being made right now." };
    case "ready":
      return { title: `${ref} is ready!`, body: fulfilment === "dine_in" ? "Your order is ready to serve." : "Come and pick it up at the counter." };
    case "on_the_way":
      return { title: `${ref} is on its way`, body: "Your delivery has left Palm Bite." };
    case "completed":
      return { title: fulfilment === "delivery" ? `${ref} delivered` : `${ref} complete`, body: "Enjoy, Palm Fren! Thank you for ordering." };
    case "cancelled":
      return { title: `Order ${ref} cancelled`, body: "Message Palm Bite if you have any questions." };
    default:
      return null;
  }
}

export const OPEN_STATUSES: OrderStatus[] = ["new", "confirmed", "preparing", "ready", "on_the_way"];
