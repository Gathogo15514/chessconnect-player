"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const TABS = [
  { href: "/dashboard", symbol: "♟", label: "HOME",      color: "#E8C547" },
  { href: "/quests",    symbol: "⚔",  label: "QUESTS",    color: "#FB923C" },
  { href: "/guild",     symbol: "♜",  label: "GUILD",     color: "#60A5FA" },
  { href: "/progress",  symbol: "♛",  label: "XP",        color: "#A78BFA" },
  { href: "/profile",   symbol: "♚",  label: "PROFILE",   color: "#E8C547" },
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
        (supabase.from("sr_queue") as any).select("id").eq("player_id", player.id).eq("is_active", true)
          .lte("due_date", new Date().toISOString().slice(0, 10)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_assignments") as any).select("id").eq("player_id", player.id).eq("status", "active"),
      ])
      setQuestBadge((srRes.data ?? []).length + (assignRes.data ?? []).length)
    })
  }, [])

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: "calc(58px + env(safe-area-inset-bottom, 0px))",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      background: "rgba(9,9,11,0.97)",
      borderTop: "1px solid rgba(232,197,71,0.12)",
      backdropFilter: "blur(28px)",
      WebkitBackdropFilter: "blur(28px)",
      display: "flex",
      zIndex: 50,
    }}>
      {TABS.map(t => {
        const active = path === t.href || (t.href !== "/dashboard" && path.startsWith(t.href))
        const badge  = t.href === "/quests" ? questBadge : 0
        return (
          <Link key={t.href} href={t.href} className="cc-nav-tab" style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 2, textDecoration: "none", paddingTop: 6,
            position: "relative",
          }}>
            {/* Gold top bar */}
            {active && (
              <span style={{
                position: "absolute", top: 0, left: "50%",
                transform: "translateX(-50%)",
                width: 24, height: 2.5,
                background: t.color,
                borderRadius: "0 0 3px 3px",
                boxShadow: `0 2px 10px ${t.color}`,
              }} />
            )}

            {/* Chess piece symbol */}
            <span style={{
              fontFamily: "serif",
              fontSize: 20, lineHeight: 1,
              color: active ? t.color : "rgba(255,255,255,0.3)",
              filter: active ? `drop-shadow(0 0 6px ${t.color}80)` : "none",
              animation: active ? "cc-nav-active 2.5s ease-in-out infinite" : "none",
              position: "relative",
            }}>
              {t.symbol}
              {badge > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -8,
                  minWidth: 15, height: 15,
                  background: "#EF4444", color: "#fff",
                  fontSize: 8, fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  borderRadius: 99,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1.5px solid #09090B",
                }}>
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>

            {/* Label */}
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: 8.5, letterSpacing: "0.1em",
              color: active ? t.color : "rgba(255,255,255,0.25)",
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
