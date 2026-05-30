"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const TABS = [
  { href: "/dashboard", label: "Home",      icon: HomeIcon    },
  { href: "/quests",    label: "Quests",    icon: SwordIcon   },
  { href: "/guild",     label: "Guild",     icon: GuildIcon   },
  { href: "/progress",  label: "Progress",  icon: XPIcon      },
  { href: "/profile",   label: "Profile",   icon: ProfileIcon },
]

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? "#1B5E35" : "#9CA3AF"
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9L12 3L21 9V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9Z"
        stroke={c} strokeWidth="1.8" strokeLinejoin="round" fill={active ? "#EDF4F0" : "none"} />
    </svg>
  )
}
function SwordIcon({ active }: { active: boolean }) {
  const c = active ? "#1B5E35" : "#9CA3AF"
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M14.5 2L20 7.5L8.5 19L3 21L5 15.5L14.5 2Z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" fill={active ? "#EDF4F0" : "none"} />
      <path d="M15 7L17 9" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function GuildIcon({ active }: { active: boolean }) {
  const c = active ? "#1B5E35" : "#9CA3AF"
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17 21V19C17 17.34 15.66 16 14 16H10C8.34 16 7 17.34 7 19V21" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="9" r="4" stroke={c} strokeWidth="1.8" fill={active ? "#EDF4F0" : "none"} />
      <path d="M23 21V19C23 17.65 22.12 16.5 21 16.13" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M1 21V19C1 17.65 1.88 16.5 3 16.13" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 5.13C21.1 5.5 22 6.65 22 8C22 9.35 21.1 10.5 20 10.87" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 5.13C2.9 5.5 2 6.65 2 8C2 9.35 2.9 10.5 4 10.87" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function XPIcon({ active }: { active: boolean }) {
  const c = active ? "#1B5E35" : "#9CA3AF"
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" fill={active ? "#EDF4F0" : "none"} />
    </svg>
  )
}
function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? "#1B5E35" : "#9CA3AF"
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.8" fill={active ? "#EDF4F0" : "none"} />
      <path d="M4 20C4 17.24 7.58 15 12 15C16.42 15 20 17.24 20 20" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

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
        (supabase.from("sr_queue") as any).select("id").eq("player_id", player.id)
          .eq("is_active", true).lte("due_date", new Date().toISOString().slice(0, 10)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_assignments") as any).select("id")
          .eq("player_id", player.id).eq("status", "active"),
      ])
      setQuestBadge((srRes.data ?? []).length + (assignRes.data ?? []).length)
    })
  }, [])

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: "calc(60px + env(safe-area-inset-bottom, 0px))",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      background: "#FFFFFF",
      borderTop: "1px solid rgba(0,0,0,0.08)",
      display: "flex", zIndex: 50,
      boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
    }}>
      {TABS.map(t => {
        const active  = path === t.href || (t.href !== "/dashboard" && path.startsWith(t.href))
        const badge   = t.href === "/quests" ? questBadge : 0
        const Icon    = t.icon
        return (
          <Link key={t.href} href={t.href} className="cc-nav-tab" style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 3, textDecoration: "none",
          }}>
            <div style={{ position: "relative" }}>
              <Icon active={active} />
              {badge > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -6,
                  minWidth: 15, height: 15,
                  background: "#DC2626", color: "#fff",
                  fontSize: 8, fontWeight: 700,
                  borderRadius: 99, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  border: "1.5px solid #fff",
                }}>
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </div>
            <span style={{
              fontSize: 10, fontWeight: active ? 600 : 400,
              color: active ? "#1B5E35" : "#9CA3AF",
              letterSpacing: "0.01em",
            }}>
              {t.label}
            </span>
            {active && (
              <span style={{
                position: "absolute", top: 0, left: "50%",
                transform: "translateX(-50%)",
                width: 20, height: 2.5,
                background: "#1B5E35",
                borderRadius: "0 0 3px 3px",
              }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
