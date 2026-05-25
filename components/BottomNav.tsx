"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const TABS = [
  { href: "/dashboard",  icon: "⌂",  label: "Home"    },
  { href: "/quests",     icon: "⚔️", label: "Quests"  },
  { href: "/guild",      icon: "🏰", label: "Guild"   },
  { href: "/progress",   icon: "📊", label: "XP"      },
  { href: "/profile",    icon: "👤", label: "Profile" },
]

export function BottomNav() {
  const path = usePathname()
  const [questBadge, setQuestBadge] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) return

      // Count SR queue due + active assignments with incomplete nodes
      const [srRes, assignRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sr_queue") as any)
          .select("id")
          .eq("player_id", player.id).eq("is_active", true)
          .lte("due_date", new Date().toISOString().slice(0, 10)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_assignments") as any)
          .select("id").eq("player_id", player.id).eq("status", "active"),
      ])

      const srCount     = (srRes.data ?? []).length
      const assignCount = (assignRes.data ?? []).length
      setQuestBadge(srCount + assignCount)
    })
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex z-50">
      {TABS.map(t => {
        const active = path === t.href || (t.href !== "/dashboard" && path.startsWith(t.href))
        const badge  = t.href === "/quests" ? questBadge : 0
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors relative ${
              active ? "text-green-800" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <span className="text-[22px] leading-none relative">
              {t.icon}
              {badge > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
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
