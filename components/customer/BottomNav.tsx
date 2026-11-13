"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/menu", label: "Menu", icon: "cup" },
  { href: "/scan", label: "Scan", icon: "scan" },
  { href: "/rewards", label: "Rewards", icon: "gift" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4 pb-[calc(var(--safe-bottom)+0.75rem)]"
    >
      <ul className="flex items-center justify-between rounded-full bg-ink px-2 py-2 text-cream shadow-lift">
        {items.map((item) => {
          const active = path === item.href || path.startsWith(`${item.href}/`);
          if (item.href === "/scan") {
            return (
              <li key={item.href}>
                <Link
                  href="/scan"
                  aria-current={active ? "page" : undefined}
                  className="-my-5 flex size-16 flex-col items-center justify-center rounded-full border-4 border-cream bg-peach text-olive-night shadow-soft transition-transform active:scale-95"
                >
                  <Icon name="scan" className="size-6" />
                  <span className="sr-only">Scan and earn</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-full text-[0.68rem] font-medium transition-colors ${
                  active ? "text-peach" : "text-cream/65 hover:text-cream"
                }`}
              >
                <Icon name={item.icon} className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
