import { Badge } from "@/components/ui/Badge";
import { statusLabel } from "@/lib/order/status";
import type { Order, OrderStatus } from "@/lib/types";

const TONE: Record<OrderStatus, "peach" | "olive" | "sage" | "muted" | "danger"> = {
  new: "peach",
  confirmed: "olive",
  preparing: "olive",
  ready: "sage",
  on_the_way: "sage",
  completed: "muted",
  cancelled: "danger",
};

export function OrderStatusBadge({ status, fulfilment = "pickup" }: { status: OrderStatus; fulfilment?: Order["fulfilment"] }) {
  return <Badge tone={TONE[status]}>{statusLabel(status, fulfilment)}</Badge>;
}

export function PaymentBadge({ status }: { status: Order["payment_status"] }) {
  if (status === "paid") return <Badge tone="olive">Paid</Badge>;
  if (status === "receipt_sent") return <Badge tone="peach">Receipt sent</Badge>;
  return <Badge tone="muted">Not paid yet</Badge>;
}
