"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/staff", label: "Approvals", icon: "check" },
  { href: "/staff/orders", label: "Orders", icon: "bag" },
  { href: "/staff/redeem", label: "Redeem", icon: "gift" },
  { href: "/staff/check-in", label: "Check in", icon: "users" },
  { href: "/staff/qr", label: "Visit QR", icon: "qr" },
];

export function StaffShell({ isAdmin, name, children }: { isAdmin: boolean; name: string; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-dvh bg-cream">
      <header className="bg-olive text-cream">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Wordmark height={22} className="text-peach" />
            <span className="rounded-full bg-cream/12 px-2.5 py-1 text-xs font-semibold">Palm Staff</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-cream/75 sm:inline">{name}</span>
            {isAdmin && (
              <Link href="/admin" className="rounded-full bg-cream px-3 py-1.5 font-semibold text-olive-night">
                Admin
              </Link>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3" aria-label="Staff">
          {tabs.map((t) => {
            const active = t.href === "/staff" ? path === "/staff" : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-semibold ${
                  active ? "bg-cream text-olive-night" : "text-cream/80 hover:text-cream"
                }`}
              >
                <Icon name={t.icon} className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
