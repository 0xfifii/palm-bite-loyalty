"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";

const nav: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Overview", icon: "chart" },
  { href: "/admin/customers", label: "Customers", icon: "users" },
  { href: "/admin/visits", label: "Visits", icon: "list" },
  { href: "/admin/qr", label: "QR display", icon: "qr" },
  { href: "/admin/rewards", label: "Rewards", icon: "gift" },
  { href: "/admin/drinks", label: "Drinks menu", icon: "cup" },
  { href: "/admin/reports", label: "Reports", icon: "download" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export function AdminShell({ name, signOut, children }: { name: string; signOut: () => Promise<void>; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const links = (
    <ul className="space-y-1">
      {nav.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[0.95rem] font-medium transition-colors ${
              isActive(item.href) ? "bg-cream text-olive-night" : "text-cream/80 hover:bg-cream/10 hover:text-cream"
            }`}
          >
            <Icon name={item.icon} className="size-5" />
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  const footer = (
    <div className="space-y-2 border-t border-cream/15 pt-4 text-sm">
      <Link href="/staff" className="flex items-center gap-2 rounded-xl px-4 py-2 text-cream/80 hover:text-cream">
        <Icon name="gift" className="size-4" /> Staff tools
      </Link>
      <Link href="/home" className="flex items-center gap-2 rounded-xl px-4 py-2 text-cream/80 hover:text-cream">
        <Icon name="phone" className="size-4" /> Customer app
      </Link>
      <form action={signOut}>
        <button className="flex w-full items-center gap-2 rounded-xl px-4 py-2 text-left text-cream/80 hover:text-cream">
          <Icon name="logout" className="size-4" /> Sign out
        </button>
      </form>
      <p className="px-4 pt-2 text-xs text-cream/55">Signed in as {name}</p>
    </div>
  );

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between bg-olive-deep px-4 py-6 text-cream lg:flex">
        <div>
          <div className="mb-8 flex items-center gap-2 px-4 text-peach">
            <Wordmark height={24} />
          </div>
          <nav aria-label="Admin">{links}</nav>
        </div>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-olive-deep px-5 py-3.5 text-cream lg:hidden">
        <Wordmark height={20} className="text-peach" />
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="rounded-full bg-cream/12 px-4 py-2 text-sm font-semibold"
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>
      {open && (
        <div id="admin-mobile-nav" className="fixed inset-x-0 top-[3.75rem] bottom-0 z-30 overflow-y-auto bg-olive-deep px-4 py-4 text-cream lg:hidden">
          <nav aria-label="Admin">{links}</nav>
          <div className="mt-6">{footer}</div>
        </div>
      )}

      <main className="min-w-0 px-5 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
