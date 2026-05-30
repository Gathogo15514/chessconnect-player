"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const TABS = [
  { href: "/dashboard", icon: "♜",  label: "Home",    color: "#10B981" },
  { href: "/quests",    icon: "⚔️", label: "Quests",  color: "#F59E0B" },
  { href: "/guild",     icon: "🏰", label: "Guild",   color: "#60A5FA" },
  { href: "/progress",  icon: "⚡", label: "XP",      color: "#818CF8" },
  { href: "/profile",   icon: "👤", label: "Profile", color: "#94A3B8" },
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

      const [srRes, assignRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sr_queue") as any)
          .select("id").eq("player_id", player.id).eq("is_active", true)
          .lte("due_date", new Date().toISOString().slice(0, 10)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_assignments") as any)
          .select("id").eq("player_id", player.id).eq("status", "active"),
      ])
      setQuestBadge((srRes.data ?? []).length + (assignRes.data ?? []).length)
    })
  }, [])

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: "calc(60px + env(safe-area-inset-bottom, 0px))",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      background: "rgba(7,11,23,0.97)",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      display: "flex",
      zIndex: 50,
    }}>
      {TABS.map(t => {
        const active = path === t.href || (t.href !== "/dashboard" && path.startsWith(t.href))
        const badge  = t.href === "/quests" ? questBadge : 0
        return (
          <Link key={t.href} href={t.href} className="cc-nav-tab" style={{
            flex: 1,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 3, textDecoration: "none",
            paddingTop: 8, position: "relative",
          }}>
            {/* Active top indicator */}
            {active && (
              <span style={{
                position: "absolute", top: 0, left: "50%",
                transform: "translateX(-50%)",
                width: 28, height: 3,
                background: t.color,
                borderRadius: "0 0 4px 4px",
                boxShadow: `0 0 10px ${t.color}80`,
              }} />
            )}

            {/* Icon */}
            <span style={{
              fontSize: 22, lineHeight: 1,
              position: "relative",
              filter: active ? `drop-shadow(0 0 7px ${t.color})` : "none",
              opacity: active ? 1 : 0.38,
              animation: active ? "cc-nav-glow 2.5s ease-in-out infinite" : "none",
            }}>
              {t.icon}
              {badge > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -9,
                  minWidth: 16, height: 16,
                  background: "#EF4444", color: "#fff",
                  fontSize: 9, fontWeight: 700,
                  borderRadius: 99,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--cc-font-display)",
                  border: "1.5px solid #070B17",
                }}>
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>

            {/* Label */}
            <span style={{
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              color: active ? t.color : "rgba(148,163,184,0.45)",
              fontFamily: "var(--cc-font-display)",
              letterSpacing: "0.04em",
              lineHeight: 1,
            }}>
              {t.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
