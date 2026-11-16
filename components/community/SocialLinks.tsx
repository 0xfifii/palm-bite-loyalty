import { Icon, type IconName } from "@/components/ui/Icon";
import { SOCIAL } from "@/lib/brand/social";

/** WhatsApp, Instagram, TikTok and WhatsApp community buttons. Empty links are hidden. */
export function SocialLinks({ whatsappChat }: { whatsappChat: string }) {
  const links: { href: string; label: string; sub: string; icon: IconName; bg: string }[] = [
    { href: SOCIAL.whatsappCommunity, label: "WhatsApp community", sub: "News, drops and meet-ups", icon: "people", bg: "bg-[#1F8A4C] text-white" },
    { href: whatsappChat, label: "Chat with us", sub: "Order and ask on WhatsApp", icon: "chat", bg: "bg-[#1F8A4C] text-white" },
    { href: SOCIAL.instagram, label: "Instagram", sub: "@palm.bite", icon: "instagram", bg: "bg-[#B5677D] text-white" },
    { href: SOCIAL.tiktok, label: "TikTok", sub: "@palm.bite_", icon: "music", bg: "bg-ink text-cream" },
  ].filter((l) => l.href);
  return (
    <ul className="grid grid-cols-2 gap-2">
      {links.map((l) => (
        <li key={l.label}>
          <a href={l.href} target="_blank" rel="noopener noreferrer" className={`flex h-full items-center gap-3 rounded-2xl p-3.5 transition-transform active:scale-[0.98] ${l.bg}`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15">
              <Icon name={l.icon} className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-tight font-semibold">{l.label}</span>
              <span className="block truncate text-xs opacity-80">{l.sub}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
