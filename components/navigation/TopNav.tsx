"use client";

import Link from "next/link";
import { BookOpen, Settings, Dices, Star, ShoppingBag, BarChart2, GraduationCap, CreditCard, Target, CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import LockButton from "@/components/parent-pin/LockButton";
import MiniDie from "@/components/game/MiniDie";

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";

const navItems = [
  { href: "/play", label: "Play", icon: Dices },
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/word-bank", label: "Words", icon: BookOpen },
  { href: "/sticker-book", label: "Stickers", icon: Star },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/dashboard", label: "Progress", icon: BarChart2 },
  // Grown-up pages: on phones these sit with Settings in the top row so the
  // children's row of links has room for full labels.
  { href: "/teacher", label: "Teacher", icon: GraduationCap, grownUp: true },
  { href: "/billing", label: "Billing", icon: CreditCard, grownUp: true },
];

const grownUpItems = navItems.filter((i) => i.grownUp);

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-50 border-b pt-[env(safe-area-inset-top)]"
      style={{
        borderColor: "var(--color-line)",
        backdropFilter: "blur(12px)",
        backgroundColor: "color-mix(in srgb, var(--color-bg-surface) 92%, transparent)",
      }}
    >
      {/* Phones: logo + account on one row, the links on a second row.
          Wider screens: everything on one row. */}
      <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-x-3 px-3 sm:px-4 py-1.5 md:py-2">
        {/* Logo */}
        <Link
          href="/play"
          className="order-1 flex items-center gap-2 font-extrabold text-lg shrink-0 rounded-lg"
          style={{ color: "var(--color-text-primary)" }}
        >
          <MiniDie face={5} className="size-7 -rotate-6" />
          <span className="sr-only sm:not-sr-only md:sr-only xl:not-sr-only">Roll &amp; Read</span>
        </Link>

        {/* Nav links */}
        <ul className="order-3 md:order-2 w-full md:w-auto flex items-stretch justify-between md:justify-center gap-0.5 lg:gap-1 -mx-1 md:mx-0">
          {navItems.map(({ href, label, icon: Icon, grownUp }) => {
            const current = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className={cn("flex-1 md:flex-none min-w-0", grownUp && "hidden md:block")}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  title={label}
                  className={cn(
                    "flex flex-col xl:flex-row items-center justify-center gap-0.5 xl:gap-1.5",
                    "px-1 sm:px-2.5 xl:px-3 py-1.5 rounded-xl font-semibold transition-colors",
                    "text-[11px] sm:text-xs xl:text-sm leading-tight",
                    !current && "hover:bg-[var(--color-hover)]"
                  )}
                  style={
                    current
                      ? { background: "var(--color-brand)", color: "var(--color-on-brand)" }
                      : { color: "var(--color-text-muted)" }
                  }
                >
                  <Icon size={18} aria-hidden="true" className="shrink-0" />
                  <span className="truncate max-w-full">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right side */}
        <div className="order-2 md:order-3 flex items-center gap-1 shrink-0">
          <LockButton />
          {grownUpItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className="md:hidden flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--color-hover)]"
              style={
                pathname === href
                  ? { background: "var(--color-brand)", color: "var(--color-on-brand)" }
                  : { color: "var(--color-text-muted)" }
              }
              aria-label={label}
              title={label}
            >
              <Icon size={20} aria-hidden="true" />
            </Link>
          ))}
          <Link
            href="/help"
            className="flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--color-hover)]"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Help"
            title="Help"
          >
            <CircleHelp size={20} aria-hidden="true" />
          </Link>
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className="flex items-center justify-center rounded-xl transition-colors hover:bg-[var(--color-hover)]"
            style={{ color: pathname === "/settings" ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={20} aria-hidden="true" />
          </Link>
          {!IS_E2E && (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
