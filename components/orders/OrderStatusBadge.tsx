import { Badge } from "@/components/ui/Badge";
import type { Order } from "@/lib/types";

export const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  new: "New",
  confirmed: "Confirmed",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: Order["status"] }) {
  const tone = { new: "peach", confirmed: "olive", ready: "sage", completed: "muted", cancelled: "danger" } as const;
  return <Badge tone={tone[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
