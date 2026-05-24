"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/dashboard",  icon: "⌂",  label: "Home"     },
  { href: "/quests",     icon: "⚔️", label: "Quests"   },
  { href: "/sessions",   icon: "📅", label: "Sessions" },
  { href: "/progress",   icon: "📊", label: "Progress" },
  { href: "/profile",    icon: "👤", label: "Profile"  },
]

export function BottomNav() {
  const path = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex z-50">
      {TABS.map(t => {
        const active = path === t.href || (t.href !== "/dashboard" && path.startsWith(t.href))
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors relative ${
              active ? "text-green-800" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <span className="text-[22px] leading-none">{t.icon}</span>
            <span className={`text-[10px] font-medium ${active ? "font-bold text-green-800" : ""}`}>{t.label}</span>
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-green-800 rounded-b-full" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
