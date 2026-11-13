import { CommunityArt } from "./CommunityArt";
import { Icon } from "@/components/ui/Icon";
import type { CommunityItem } from "@/lib/types";

export function CommunityCard({ item, compact = false }: { item: CommunityItem; compact?: boolean }) {
  const tone = item.icon === "book" ? "bg-[#6B4E3D]" : item.icon === "fitness" ? "bg-olive-deep" : "bg-[#B5677D]";
  return (
    <article className={`overflow-hidden rounded-[var(--radius-sheet)] text-cream ${tone}`}>
      <div className={`flex items-start justify-between gap-3 p-5 ${compact ? "pb-2" : ""}`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-peach">{item.kind === "event" ? "Event" : "Club"}</p>
          <h3 className="type-heading mt-1 text-[1.45rem] leading-tight">{item.title}</h3>
          {item.tagline && <p className="mt-1 text-cream/80">{item.tagline}</p>}
        </div>
        <CommunityArt icon={item.icon} day={item.starts_at ? new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Africa/Lagos" }).format(new Date(item.starts_at)) : undefined} className="h-20 w-28 shrink-0" />
      </div>
      {!compact && (
        <div className="space-y-3 px-5 pb-5">
          {item.description && <p className="leading-relaxed text-cream/90">{item.description}</p>}
          <ul className="space-y-1.5 text-sm text-cream/85">
            <li className="flex items-center gap-2">
              <Icon name="calendar" className="size-4 shrink-0 text-peach" />
              {item.schedule || "Dates coming soon. Ask us at the counter."}
            </li>
            {item.location && (
              <li className="flex items-center gap-2">
                <Icon name="pin" className="size-4 shrink-0 text-peach" />
                {item.location}
              </li>
            )}
          </ul>
          {item.join_link && (
            <a
              href={item.join_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-cream px-5 font-semibold text-olive-night"
            >
              {item.kind === "event" ? "Get details" : "Join the club"} <Icon name="arrow" className="size-4" />
            </a>
          )}
        </div>
      )}
    </article>
  );
}
