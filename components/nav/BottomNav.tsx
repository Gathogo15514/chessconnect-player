"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, GraduationCap, Grid2x2, TrendingUp, Trophy } from "lucide-react"

// Five slots by design (mobile tab bar, not a scrollable list) — Games
// stays reachable from the desktop Sidebar and its own URL, just not a
// primary tab, so Leaderboard (part of the core coach->teach->assign->
// track->improve loop) has room here instead.
const TABS = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/train",       label: "Train",       icon: GraduationCap },
  { href: "/puzzles",     label: "Puzzles",     icon: Grid2x2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/progress",    label: "Progress",    icon: TrendingUp },
]

export function BottomNav() {
  const path = usePathname()

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card md:hidden">
      {TABS.map(t => {
        const active = path === t.href || path.startsWith(t.href + "/")
        const Icon = t.icon
        return (
          <Link
            key={t.href}
            href={t.href}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 no-underline transition-opacity active:opacity-60"
          >
            <Icon size={21} strokeWidth={1.8} className={active ? "text-primary" : "text-muted-foreground"} />
            <span className={"text-[10px] tracking-[0.01em] " + (active ? "font-semibold text-primary" : "font-normal text-muted-foreground")}>
              {t.label}
            </span>
            {active && (
              <span className="absolute top-0 left-1/2 h-[2.5px] w-5 -translate-x-1/2 rounded-b-[3px] bg-primary" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
