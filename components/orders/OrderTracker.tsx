import { Icon } from "@/components/ui/Icon";
import { statusLabel, trackerSteps } from "@/lib/order/status";
import type { Order } from "@/lib/types";

/** A simple step tracker: Sent, Confirmed, Preparing, Ready or On its way, Done. */
export function OrderTracker({ status, fulfilment }: { status: Order["status"]; fulfilment: Order["fulfilment"] }) {
  if (status === "cancelled") return null;
  const steps = trackerSteps(fulfilment);
  const at = steps.indexOf(status);
  return (
    <ol className="mt-4 grid grid-cols-6 gap-1" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = i < at || status === "completed";
        const now = i === at && status !== "completed";
        return (
          <li key={s} className="flex flex-col items-center text-center" aria-current={now ? "step" : undefined}>
            <span
              className={`grid size-8 place-items-center rounded-full text-xs font-bold ${
                done ? "bg-olive-deep text-cream" : now ? "animate-pulse bg-peach text-olive-night ring-4 ring-peach/40" : "bg-sage-mist text-muted"
              }`}
            >
              {done ? <Icon name="check" className="size-4" /> : s === "on_the_way" ? <Icon name="truck" className="size-4" /> : i + 1}
            </span>
            <span className={`mt-1.5 text-[0.68rem] leading-tight ${now ? "font-bold text-ink" : "text-muted"}`}>{statusLabel(s, fulfilment)}</span>
          </li>
        );
      })}
    </ol>
  );
}
