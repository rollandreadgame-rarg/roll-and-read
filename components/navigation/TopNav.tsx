"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { BookOpen, Settings, Dices, Star, ShoppingBag, BarChart2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/play", label: "Play", icon: Dices },
  { href: "/word-bank", label: "Words", icon: BookOpen },
  { href: "/sticker-book", label: "Stickers", icon: Star },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/dashboard", label: "Progress", icon: BarChart2 },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 border-b"
      style={{
        background: "rgba(var(--color-bg-surface), 0.9)",
        borderColor: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        backgroundColor: "color-mix(in srgb, var(--color-bg-surface) 90%, transparent)",
      }}
    >
      {/* Logo */}
      <Link href="/play" className="flex items-center gap-2 font-extrabold text-lg" style={{ color: "var(--color-text-primary)" }}>
        <span className="text-2xl">🎲</span>
        <span className="hidden sm:block">Roll &amp; Read</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
              pathname === href
                ? "text-white"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            )}
            style={pathname === href ? { background: "var(--color-brand)", color: "white" } : {}}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Settings"
        >
          <Settings size={18} />
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    </nav>
  );
}
