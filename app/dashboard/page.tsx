"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { getAvatar }           from "@/lib/avatars"
import type { AvatarId }       from "@/lib/avatars"
import { fmtDateShort, fmtWeekday } from "@/lib/dates"

type Player = {
  id: string
  fide_id?: string | null
  fide_title?: string | null
  current_rating?: number | null
  school_id?: string | null
  club_id?: string | null
  schools?: { name: string } | null
  clubs?:   { name: string } | null
}

type Session = {
  id: string
  title: string
  session_date: string
  start_time: string
  status: string
  venue?: string | null
}

type AttendanceRecord = {
  status: string
  sessions?: { title: string; session_date: string } | null
}

type RatingEntry = { rating: number; recorded_at: string }

type GameProfile = {
  current_level:      number
  total_xp:           number
  gold_balance:       number
  streak_current:     number
  level_xp_start:     number
  level_xp_threshold: number
  avatar_id?:         string | null
}

const STATUS_ICON: Record<string, string> = {
  present: "✅", late: "⏰", excused: "🔵", absent: "❌",
}
const STATUS_COLOR: Record<string, string> = {
  present: "#4ade80", late: "#fbbf24", excused: "#60a5fa", absent: "#f87171",
}

const QUICK_LINKS = [
  { href: "/quests",       label: "Quest Map",     icon: "⚔️",  color: "#10b981", glow: "rgba(16,185,129,0.2)"  },
  { href: "/puzzle-rush",  label: "Puzzle Rush",   icon: "⚡",  color: "#f59e0b", glow: "rgba(245,158,11,0.2)"  },
  { href: "/duel",         label: "Friendly Duel", icon: "🤺",  color: "#ef4444", glow: "rgba(239,68,68,0.2)"   },
  { href: "/encounters",   label: "Boss Returns",  icon: "👹",  color: "#dc2626", glow: "rgba(220,38,38,0.2)"   },
  { href: "/guild",        label: "Guild",         icon: "🏰",  color: "#3b82f6", glow: "rgba(59,130,246,0.2)"  },
  { href: "/progress",     label: "XP & Level",    icon: "📊",  color: "#8b5cf6", glow: "rgba(139,92,246,0.2)"  },
  { href: "/gold-shop",    label: "The Armory",    icon: "🗡️", color: "#f59e0b", glow: "rgba(245,158,11,0.2)"  },
  { href: "/performance",  label: "Performance",   icon: "📈",  color: "#10b981", glow: "rgba(16,185,129,0.2)"  },
  { href: "/sessions",     label: "Sessions",      icon: "📅",  color: "#64748b", glow: "rgba(100,116,139,0.2)" },
  { href: "/tournaments",  label: "Tournaments",   icon: "🏆",  color: "#f59e0b", glow: "rgba(245,158,11,0.2)"  },
  { href: "/profile",      label: "My Profile",    icon: "👤",  color: "#94a3b8", glow: "rgba(148,163,184,0.2)" },
  { href: "/medical",      label: "Medical",       icon: "🏥",  color: "#64748b", glow: "rgba(100,116,139,0.2)" },
]

function xpPct(total: number, start: number, threshold: number) {
  const range = threshold - start
  const prog  = total - start
  if (range <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((prog / range) * 100)))
}

export default function DashboardPage() {
  const router = useRouter()
  const [name,          setName]          = useState<string | null>(null)
  const [player,        setPlayer]        = useState<Player | null>(null)
  const [gp,            setGp]            = useState<GameProfile | null>(null)
  const [sessions,      setSessions]      = useState<Session[]>([])
  const [attendance,    setAttendance]    = useState<AttendanceRecord[]>([])
  const [ratingHistory, setRatingHistory] = useState<RatingEntry[]>([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      const uid = session.user.id

      const [profileRes, playerRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("profiles") as any).select("full_name").eq("id", uid).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("players") as any)
          .select("id, fide_id, fide_title, current_rating, school_id, club_id, schools(name), clubs(name)")
          .eq("profile_id", uid).maybeSingle(),
      ])

      setName(profileRes.data?.full_name ?? null)
      const pl: Player | null = playerRes.data ?? null
      setPlayer(pl)
      if (!pl) { setLoading(false); return }

      // Update streak on every dashboard visit
      supabase.rpc("update_player_streak", { p_player_id: pl.id }).then(() => {})

      const todayStr = new Date().toISOString().slice(0, 10)
      const in4w     = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10)
      const filters  = []
      if (pl.school_id) filters.push(`school_id.eq.${pl.school_id}`)
      if (pl.club_id)   filters.push(`club_id.eq.${pl.club_id}`)
      const orFilter = filters.length ? filters.join(",") : "id.eq.00000000-0000-0000-0000-000000000000"

      const [sessRes, attRes, ratingRes, gpRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sessions") as any)
          .select("id, title, session_date, start_time, status, venue")
          .or(orFilter)
          .gte("session_date", todayStr).lte("session_date", in4w)
          .order("session_date").order("start_time").limit(4),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("attendance") as any)
          .select("status, sessions(title, session_date)")
          .eq("player_id", pl.id)
          .order("marked_at", { ascending: false }).limit(5),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_ratings_history") as any)
          .select("rating, recorded_at")
          .eq("player_id", pl.id)
          .order("recorded_at", { ascending: false }).limit(8),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles") as any)
          .select("current_level, total_xp, gold_balance, streak_current, level_xp_start, level_xp_threshold, avatar_id")
          .eq("player_id", pl.id).maybeSingle(),
      ])

      setSessions(sessRes.data ?? [])
      setAttendance(attRes.data ?? [])
      setRatingHistory(ratingRes.data ?? [])
      setGp(gpRes.data ?? null)
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const firstName    = name?.split(" ")[0] ?? "Player"
  const avatar       = getAvatar(gp?.avatar_id as AvatarId | undefined)
  const ratingDelta  = ratingHistory.length >= 2
    ? ratingHistory[0].rating - ratingHistory[1].rating : null
  const xpProgress   = gp ? xpPct(gp.total_xp, gp.level_xp_start, gp.level_xp_threshold) : 0
  const presentCount = attendance.filter(a => a.status === "present").length

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0a0f1a" }}>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 12px rgba(16,185,129,0.3); }
          50%       { box-shadow: 0 0 24px rgba(16,185,129,0.6); }
        }
        @keyframes xp-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float-badge {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        background: "linear-gradient(180deg, #0a0f1a 0%, #0f172a 100%)",
        borderBottom: "1px solid rgba(16,185,129,0.2)",
      }} className="px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 24, filter: "drop-shadow(0 0 8px #10b981)" }}>♟</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#10b981",
            textShadow: "0 0 12px rgba(16,185,129,0.4)" }}>
            ChessConnect
          </span>
        </div>
        <button onClick={handleSignOut}
          style={{ color: "rgba(16,185,129,0.45)", fontSize: 13 }}>
          Sign out
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <div style={{
              width: 40, height: 40,
              border: "4px solid #10b981", borderTopColor: "transparent",
              borderRadius: "50%", animation: "spin 1s linear infinite",
            }} />
          </div>
        ) : (
          <>
            {/* ── Hero character card ──────────────────────────────────────── */}
            <div style={{
              background: "linear-gradient(135deg, #0f2a1a 0%, #1e293b 60%, #14532d22 100%)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 24, padding: "20px 20px 16px",
              position: "relative", overflow: "hidden",
            }}>
              {/* Background glow */}
              <div style={{
                position: "absolute", top: -30, right: -30,
                width: 140, height: 140, borderRadius: "50%",
                background: `radial-gradient(circle, ${avatar.glow} 0%, transparent 70%)`,
                pointerEvents: "none",
              }} />

              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                {/* Avatar orb */}
                <div style={{
                  width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
                  background: `radial-gradient(circle at 35% 35%, ${avatar.color}44, ${avatar.color}11)`,
                  border: `3px solid ${avatar.color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 34,
                  boxShadow: avatar.glow ? `0 0 20px ${avatar.glow}` : undefined,
                  animation: "float-badge 3s ease-in-out infinite",
                }}>
                  {avatar.emoji}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + title */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ color: "#f8fafc", fontWeight: 800, fontSize: 20 }}>
                      {firstName}
                    </p>
                    {player?.fide_title && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "#f59e0b",
                        background: "rgba(245,158,11,0.12)",
                        border: "1px solid rgba(245,158,11,0.3)",
                        borderRadius: 6, padding: "2px 7px", letterSpacing: "0.08em",
                      }}>
                        {player.fide_title}
                      </span>
                    )}
                  </div>
                  <p style={{ color: avatar.color, fontSize: 12, fontWeight: 600, marginTop: 1 }}>
                    {avatar.name} · {avatar.class}
                  </p>
                  <p style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
                    {player?.schools?.name ?? player?.clubs?.name ?? "Independent"}
                    {player?.fide_id ? ` · FIDE ${player.fide_id}` : ""}
                  </p>

                  {/* Level + XP bar — always show; defaults to level 1, 0 XP */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600 }}>
                        LEVEL {gp?.current_level ?? 1}
                      </span>
                      <span style={{ color: "#10b981", fontSize: 10, fontWeight: 700 }}>
                        {xpProgress}% · {(gp?.total_xp ?? 0).toLocaleString()} XP
                      </span>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.max(2, xpProgress)}%`, height: "100%", borderRadius: 99,
                        background: "linear-gradient(90deg, #10b981, #34d399, #10b981)",
                        backgroundSize: "200% auto",
                        animation: "xp-shimmer 2s linear infinite",
                        boxShadow: "0 0 10px rgba(16,185,129,0.5)",
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Streak banner ─────────────────────────────────────────────── */}
            {gp && gp.streak_current > 0 && (
              <div style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))",
                border: "1px solid rgba(245,158,11,0.3)", borderRadius: 16,
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 28, animation: "float-badge 2s ease-in-out infinite" }}>🔥</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#f59e0b", fontWeight: 800, fontSize: 15 }}>
                    {gp.streak_current}-Day Streak!
                  </p>
                  <p style={{ color: "rgba(245,158,11,0.6)", fontSize: 11, marginTop: 2 }}>
                    You're on fire — don't break the chain!
                  </p>
                </div>
                <div style={{
                  background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: 12, padding: "6px 14px", textAlign: "center",
                }}>
                  <p style={{ color: "#f59e0b", fontWeight: 900, fontSize: 22, lineHeight: 1 }}>
                    {gp.streak_current}
                  </p>
                  <p style={{ color: "rgba(245,158,11,0.5)", fontSize: 9, fontWeight: 700 }}>DAYS</p>
                </div>
              </div>
            )}

            {/* ── Stat row ─────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Rating */}
              <div style={{
                background: "#111827", border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 18, padding: "14px 16px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}>
                <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Rating ♔
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <span style={{ color: "#f8fafc", fontWeight: 800, fontSize: 24 }}>
                    {player?.current_rating ?? "—"}
                  </span>
                  {ratingDelta !== null && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: ratingDelta >= 0 ? "#4ade80" : "#f87171" }}>
                      {ratingDelta >= 0 ? "+" : ""}{ratingDelta}
                    </span>
                  )}
                </div>
              </div>

              {/* Gold */}
              <div style={{
                background: "#111827", border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 18, padding: "14px 16px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}>
                <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Gold 🪙
                </p>
                <p style={{ color: "#f59e0b", fontWeight: 800, fontSize: 24, marginTop: 4 }}>
                  {(gp?.gold_balance ?? 0).toLocaleString()}
                </p>
              </div>

              {/* Attendance */}
              <div style={{
                background: "#111827", border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 18, padding: "14px 16px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}>
                <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Battles Won
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                  <span style={{ color: "#60a5fa", fontWeight: 800, fontSize: 24 }}>
                    {presentCount}
                  </span>
                  <span style={{ color: "#334155", fontSize: 14, fontWeight: 600 }}>
                    /{attendance.length}
                  </span>
                </div>
              </div>

              {/* Shield / Streak shields */}
              <div style={{
                background: "#111827", border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: 18, padding: "14px 16px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}>
                <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Total XP ⚡
                </p>
                <p style={{ color: "#a78bfa", fontWeight: 800, fontSize: 22, marginTop: 4 }}>
                  {(gp?.total_xp ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* ── Rating spark chart ────────────────────────────────────────── */}
            {ratingHistory.length > 1 && (
              <div style={{
                background: "#111827", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 18, padding: "14px 16px",
              }}>
                <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  Rating Journey
                </p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56 }}>
                  {[...ratingHistory].reverse().map((e, i, arr) => {
                    const prev  = arr[i - 1]
                    const delta = prev ? e.rating - prev.rating : null
                    const maxR  = Math.max(...arr.map(x => x.rating))
                    const minR  = Math.min(...arr.map(x => x.rating))
                    const range = maxR - minR || 1
                    const h     = Math.max(12, Math.round(((e.rating - minR) / range) * 44) + 12)
                    const isLatest = i === arr.length - 1
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 8, fontWeight: 700,
                          color: delta !== null ? (delta >= 0 ? "#4ade80" : "#f87171") : "transparent" }}>
                          {delta !== null ? (delta >= 0 ? `+${delta}` : `${delta}`) : "·"}
                        </span>
                        <div style={{
                          height: h, width: "100%", borderRadius: "3px 3px 0 0",
                          background: isLatest ? "#10b981" : "rgba(255,255,255,0.1)",
                          boxShadow: isLatest ? "0 0 8px rgba(16,185,129,0.5)" : "none",
                        }} />
                        <span style={{ fontSize: 7, fontWeight: 700,
                          color: isLatest ? "#10b981" : "#334155" }}>
                          {e.rating}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Upcoming quests (sessions) ────────────────────────────────── */}
            <div style={{
              background: "#111827", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 20, overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <p style={{ color: "#f8fafc", fontWeight: 700, fontSize: 14 }}>
                  ⚔️ Upcoming Quests
                </p>
                <a href="/sessions" style={{ color: "#10b981", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  View all →
                </a>
              </div>
              {sessions.length === 0 ? (
                <div style={{ padding: "28px 16px", textAlign: "center" }}>
                  <p style={{ color: "#1e3a2a", fontSize: 32 }}>🗡️</p>
                  <p style={{ color: "#334155", fontSize: 13, marginTop: 6 }}>No quests scheduled yet</p>
                </div>
              ) : (
                sessions.map((s, i) => (
                  <div key={s.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px",
                    borderBottom: i < sessions.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: s.status === "in_progress"
                        ? "linear-gradient(135deg, #14532d, #166534)"
                        : "rgba(255,255,255,0.04)",
                      border: s.status === "in_progress"
                        ? "1px solid rgba(16,185,129,0.4)"
                        : "1px solid rgba(255,255,255,0.06)",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{
                        fontSize: 8, fontWeight: 700, textTransform: "uppercase",
                        color: s.status === "in_progress" ? "#4ade80" : "#475569",
                      }}>
                        {fmtWeekday(s.session_date)}
                      </span>
                      <span style={{
                        fontSize: 18, fontWeight: 800, lineHeight: 1,
                        color: s.status === "in_progress" ? "#f8fafc" : "#64748b",
                      }}>
                        {new Date(s.session_date + "T00:00:00").getDate()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#f8fafc", fontWeight: 600, fontSize: 13,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.title}
                      </p>
                      <p style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
                        {s.start_time?.slice(0, 5)}{s.venue ? ` · ${s.venue}` : ""}
                      </p>
                    </div>
                    {s.status === "in_progress" && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "#f59e0b",
                        background: "rgba(245,158,11,0.12)",
                        border: "1px solid rgba(245,158,11,0.3)",
                        borderRadius: 20, padding: "2px 8px",
                      }}>
                        LIVE
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ── Battle log (attendance) ──────────────────────────────────── */}
            {attendance.length > 0 && (
              <div style={{
                background: "#111827", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 20, overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <p style={{ color: "#f8fafc", fontWeight: 700, fontSize: 14 }}>
                    📜 Battle Log
                  </p>
                </div>
                {attendance.map((a, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 16px",
                    borderBottom: i < attendance.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{STATUS_ICON[a.status] ?? "❓"}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {a.sessions?.title ?? "Session"}
                        </p>
                        <p style={{ color: "#334155", fontSize: 10 }}>
                          {fmtDateShort(a.sessions?.session_date)}
                        </p>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: STATUS_COLOR[a.status] ?? "#64748b",
                      background: `${STATUS_COLOR[a.status] ?? "#64748b"}15`,
                      borderRadius: 20, padding: "2px 8px", flexShrink: 0,
                      textTransform: "capitalize",
                    }}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Quick action grid ─────────────────────────────────────────── */}
            <div>
              <p style={{
                color: "#334155", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.1em",
                marginBottom: 12, paddingLeft: 4,
              }}>
                My Arsenal
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {QUICK_LINKS.map(l => (
                  <a key={l.href} href={l.href} style={{
                    background: "#111827",
                    border: `1px solid ${l.glow.replace("0.2", "0.15")}`,
                    borderRadius: 16, padding: "14px 14px",
                    display: "flex", alignItems: "center", gap: 10,
                    textDecoration: "none", transition: "all 0.2s",
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.02)`,
                  }}>
                    <span style={{
                      fontSize: 22, width: 36, height: 36,
                      background: l.glow, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {l.icon}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                      {l.label}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
