"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgeAlert,
  CalendarDays,
  CalendarX2,
  ClipboardList,
  Clock,
  Cookie,
  ExternalLink,
  Images,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Settings,
  Sliders,
  Tags,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { logoutAction } from "@/server/auth/actions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: number;
};

type NavGroup = { title: string; items: NavItem[] };

export function AdminShell({
  adminName,
  newOrderCount,
  configWarnings,
  children,
}: {
  adminName: string;
  newOrderCount: number;
  configWarnings: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);

  const groups: NavGroup[] = [
    {
      title: "Работа",
      items: [
        { href: "/admin", label: "Табло", icon: LayoutDashboard, exact: true },
        {
          href: "/admin/orders",
          label: "Поръчки",
          icon: ClipboardList,
          badge: newOrderCount,
        },
        { href: "/admin/calendar", label: "Календар", icon: CalendarDays },
      ],
    },
    {
      title: "Каталог",
      items: [
        { href: "/admin/products", label: "Продукти", icon: Package },
        { href: "/admin/categories", label: "Категории", icon: Tags },
        { href: "/admin/customizations", label: "Персонализации", icon: Sliders },
        { href: "/admin/gallery", label: "Галерия", icon: Images },
      ],
    },
    {
      title: "Сайт",
      items: [
        { href: "/admin/content", label: "Съдържание", icon: Settings },
        { href: "/admin/hours", label: "Работно време", icon: Clock },
        { href: "/admin/exceptions", label: "Почивки", icon: CalendarX2 },
        { href: "/admin/announcements", label: "Съобщения", icon: Megaphone },
      ],
    },
  ];

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="min-h-dvh bg-surface-sunk text-ink">
      {/* Top bar */}
      <header
        data-admin-topbar
        className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-paper px-4 lg:pl-[268px]"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Затвори менюто" : "Отвори менюто"}
          aria-expanded={open}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-surface-sunk lg:hidden"
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>

        <p className="truncate text-[0.9rem] font-bold">
          {titleFor(pathname)}
        </p>

        <div className="ml-auto flex items-center gap-1.5">
          {configWarnings.length > 0 ? (
            <button
              type="button"
              onClick={() => setWarningsOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-3 py-1.5 text-[0.76rem] font-bold text-warning transition-colors hover:brightness-97"
            >
              <BadgeAlert size={14} aria-hidden="true" />
              {configWarnings.length} настройки
            </button>
          ) : null}

          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold text-ink-soft transition-colors hover:bg-surface-sunk hover:text-ink"
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Виж сайта</span>
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold text-ink-soft transition-colors hover:bg-surface-sunk hover:text-ink"
            >
              <LogOut size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Изход</span>
            </button>
          </form>
        </div>
      </header>

      {warningsOpen && configWarnings.length > 0 ? (
        <div className="border-b border-warning/25 bg-warning-soft px-4 py-3 lg:pl-[268px]">
          <p className="text-[0.8rem] font-bold text-warning">
            Незавършена конфигурация
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.82rem] text-warning">
            {configWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Sidebar */}
      <aside
        data-admin-sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[252px] overflow-y-auto border-r border-line bg-paper transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full bg-ink text-paper"
          >
            <Cookie size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-display)] text-[1.05rem] leading-none">
              Cakes by ELI
            </p>
            <p className="truncate text-[0.68rem] text-ink-faint">{adminName}</p>
          </div>
        </div>

        <nav aria-label="Административна навигация" className="p-3">
          {groups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="px-3 pb-1.5 text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive(item) ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[var(--radius-xs)] px-3 py-2.5 text-[0.88rem] transition-colors",
                        isActive(item)
                          ? "bg-blush-soft font-bold text-rose-deep"
                          : "text-ink-soft hover:bg-surface-sunk hover:text-ink",
                      )}
                    >
                      <item.icon size={16} aria-hidden="true" className="flex-none" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="flex min-w-5 items-center justify-center rounded-full bg-rose-dark px-1.5 py-0.5 text-[0.68rem] font-bold text-paper">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Затвори менюто"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-cocoa-deep/40 lg:hidden"
        />
      ) : null}

      <main className="px-4 py-6 lg:pl-[268px] lg:pr-6">{children}</main>
    </div>
  );
}

function titleFor(pathname: string): string {
  const map: [string, string][] = [
    ["/admin/orders", "Поръчки"],
    ["/admin/calendar", "Календар"],
    ["/admin/products", "Продукти"],
    ["/admin/categories", "Категории"],
    ["/admin/customizations", "Персонализации"],
    ["/admin/gallery", "Галерия"],
    ["/admin/content", "Съдържание на сайта"],
    ["/admin/hours", "Работно време"],
    ["/admin/exceptions", "Почивки и изключения"],
    ["/admin/announcements", "Съобщения"],
  ];
  for (const [prefix, label] of map) {
    if (pathname.startsWith(prefix)) return label;
  }
  return "Табло";
}
