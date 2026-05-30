"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { getAvatar }           from "@/lib/avatars"
import type { AvatarId }       from "@/lib/avatars"
import { fmtDateShort, fmtWeekday } from "@/lib/dates"

type Player = {
  id: string; fide_id?: string|null; fide_title?: string|null
  current_rating?: number|null; school_id?: string|null; club_id?: string|null
  schools?: { name: string }|null; clubs?: { name: string }|null
}
type Session = {
  id: string; title: string; session_date: string
  start_time: string; status: string; venue?: string|null
}
type AttendanceRecord = {
  status: string; sessions?: { title: string; session_date: string }|null
}
type RatingEntry = { rating: number; recorded_at: string }
type GameProfile = {
  current_level: number; total_xp: number; gold_balance: number
  streak_current: number; level_xp_start: number; level_xp_threshold: number
  avatar_id?: string|null
}

function xpPct(total: number, start: number, threshold: number) {
  const r = threshold - start, p = total - start
  if (r <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((p / r) * 100)))
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

const ATT: Record<string, { color: string; label: string }> = {
  present: { color: "#16A34A", label: "Present" },
  late:    { color: "#D97706", label: "Late"    },
  excused: { color: "#2563EB", label: "Excused" },
  absent:  { color: "#DC2626", label: "Absent"  },
}

const ACTIONS = [
  { href: "/quests",      label: "Quest Map",   icon: "⚔", color: "#1B5E35" },
  { href: "/puzzle-rush", label: "Puzzle Rush", icon: "⚡", color: "#B45309" },
  { href: "/duel",        label: "Duel",        icon: "🏟", color: "#1B5E35" },
  { href: "/assignments", label: "Missions",    icon: "🎯", color: "#C2571A" },
  { href: "/tournaments", label: "Tournaments", icon: "🏆", color: "#B45309" },
  { href: "/sessions",    label: "Sessions",    icon: "📅", color: "#1B5E35" },
]

export default function DashboardPage() {
  const router = useRouter()
  const [name,          setName]          = useState<string|null>(null)
  const [player,        setPlayer]        = useState<Player|null>(null)
  const [gp,            setGp]            = useState<GameProfile|null>(null)
  const [sessions,      setSessions]      = useState<Session[]>([])
  const [attendance,    setAttendance]    = useState<AttendanceRecord[]>([])
  const [ratingHistory, setRatingHistory] = useState<RatingEntry[]>([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      const uid = session.user.id
      const [pR, plR] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("profiles") as any).select("full_name").eq("id", uid).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("players") as any)
          .select("id, fide_id, fide_title, current_rating, school_id, club_id, schools(name), clubs(name)")
          .eq("profile_id", uid).maybeSingle(),
      ])
      setName(pR.data?.full_name ?? null)
      const pl = plR.data ?? null
      setPlayer(pl)
      if (!pl) { setLoading(false); return }
      supabase.rpc("update_player_streak", { p_player_id: pl.id }).then(() => {})
      const today = new Date().toISOString().slice(0, 10)
      const in4w  = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10)
      const f = [pl.school_id && `school_id.eq.${pl.school_id}`, pl.club_id && `club_id.eq.${pl.club_id}`].filter(Boolean).join(",") || "id.eq.00000000-0000-0000-0000-000000000000"
      const [sR, aR, rR, gR] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sessions") as any).select("id, title, session_date, start_time, status, venue")
          .or(f).gte("session_date", today).lte("session_date", in4w)
          .order("session_date").order("start_time").limit(3),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("attendance") as any).select("status, sessions(title, session_date)")
          .eq("player_id", pl.id).order("marked_at", { ascending: false }).limit(4),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_ratings_history") as any).select("rating, recorded_at")
          .eq("player_id", pl.id).order("recorded_at", { ascending: false }).limit(7),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles") as any)
          .select("current_level, total_xp, gold_balance, streak_current, level_xp_start, level_xp_threshold, avatar_id")
          .eq("player_id", pl.id).maybeSingle(),
      ])
      setSessions(sR.data ?? [])
      setAttendance(aR.data ?? [])
      setRatingHistory(rR.data ?? [])
      setGp(gR.data ?? null)
      setLoading(false)
    })
  }, [router])

  const firstName   = name?.split(" ")[0] ?? "Player"
  const lastName    = name?.split(" ").slice(1).join(" ") ?? ""
  const avatar      = getAvatar(gp?.avatar_id as AvatarId | undefined)
  const ratingDelta = ratingHistory.length >= 2 ? ratingHistory[0].rating - ratingHistory[1].rating : null
  const xpProgress  = gp ? xpPct(gp.total_xp, gp.level_xp_start, gp.level_xp_threshold) : 0
  const org         = player?.schools?.name ?? player?.clubs?.name ?? null

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 72 }}>
      <style>{`@keyframes cc-spin { to { transform:rotate(360deg); } } @keyframes cc-shimmer { 0%{background-position:-400% center;} 100%{background-position:400% center;} }`}</style>

      {/* ── Header ───────────────────────────────── */}
      <header style={{
        background: "#1B5E35",
        padding: "16px 18px 20px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Subtle board pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.05,
          backgroundImage: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)",
          backgroundSize: "24px 24px",
        }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          {/* Left: greeting + name */}
          <div>
            {loading ? (
              <div style={{ width: 160, height: 40, background: "rgba(255,255,255,0.08)", borderRadius: 8 }} />
            ) : (
              <>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500, marginBottom: 2 }}>
                  {getGreeting()},
                </p>
                <h1 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 34, lineHeight: 1, letterSpacing: "0.03em",
                  color: "#fff",
                }}>
                  {firstName.toUpperCase()}{lastName ? ` ${lastName.toUpperCase()}` : ""}
                </h1>
                {org && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{org}</p>
                )}
              </>
            )}
          </div>

          {/* Right: avatar */}
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            border: "2px solid rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, flexShrink: 0,
          }}>
            {loading ? null : avatar.emoji}
          </div>
        </div>

        {/* Stats chips row */}
        {!loading && (
          <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: "Rating",  value: player?.current_rating ?? "—",           delta: ratingDelta },
              { label: "Level",   value: `Lv. ${gp?.current_level ?? 1}`,         delta: null },
              { label: "Streak",  value: `${gp?.streak_current ?? 0} days 🔥`,   delta: null },
              { label: "Gold",    value: `${(gp?.gold_balance ?? 0).toLocaleString()} 🪙`, delta: null },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.12)",
                borderRadius: 99, padding: "5px 12px",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>{String(s.value)}</span>
                {s.delta !== null && (
                  <span style={{ fontSize: 11, color: s.delta >= 0 ? "#86EFAC" : "#FCA5A5", fontWeight: 600 }}>
                    {s.delta >= 0 ? `+${s.delta}` : s.delta}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div style={{ width: 32, height: 32, border: "3px solid #1B5E35", borderTopColor: "transparent", borderRadius: "50%", animation: "cc-spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── XP bar ───────────────────────────── */}
            <div className="cc-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  Level {gp?.current_level ?? 1} → Level {(gp?.current_level ?? 1) + 1}
                </span>
                <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                  {xpProgress}% · {(gp?.total_xp ?? 0).toLocaleString()} XP
                </span>
              </div>
              <div style={{ height: 8, background: "#E5E7EB", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  width: `${Math.max(2, xpProgress)}%`, height: "100%", borderRadius: 99,
                  background: "linear-gradient(90deg, #1B5E35, #2E7D50, #1B5E35)",
                  backgroundSize: "400% auto",
                  animation: "cc-shimmer 3s linear infinite",
                }} />
              </div>
            </div>

            {/* ── Upcoming sessions ─────────────────── */}
            {sessions.length > 0 && (
              <div className="cc-card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "13px 16px 11px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>Upcoming Sessions</span>
                  <a href="/sessions" style={{ fontSize: 12, color: "var(--green)", textDecoration: "none", fontWeight: 500 }}>See all</a>
                </div>
                {sessions.map((s, i) => {
                  const isLive = s.status === "in_progress"
                  return (
                    <div key={s.id} style={{
                      padding: "12px 16px",
                      borderBottom: i < sessions.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      {/* Date block */}
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                        background: isLive ? "#1B5E35" : "var(--green-bg)",
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", color: isLive ? "rgba(255,255,255,0.7)" : "var(--green)", letterSpacing: "0.06em" }}>
                          {fmtWeekday(s.session_date)}
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: isLive ? "#fff" : "var(--green)" }}>
                          {new Date(s.session_date + "T00:00:00").getDate()}
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</p>
                        <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 1 }}>
                          {s.start_time?.slice(0, 5)}{s.venue ? ` · ${s.venue}` : ""}
                        </p>
                      </div>

                      {isLive ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                          <span className="cc-live-dot" />
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#16A34A" }}>Live</span>
                        </div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M9 18L15 12L9 6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Quick actions ──────────────────────── */}
            <div>
              <p className="cc-section-label">Quick Actions</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {ACTIONS.map(a => (
                  <a key={a.href} href={a.href} style={{ textDecoration: "none" }}>
                    <div className="cc-card cc-card-press" style={{ padding: "14px 10px", textAlign: "center" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, margin: "0 auto 8px",
                        background: a.color === "#1B5E35" ? "var(--green-bg)" : "rgba(180,83,9,0.08)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18,
                      }}>
                        {a.icon}
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", lineHeight: 1.2 }}>{a.label}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* ── Rating chart ───────────────────────── */}
            {ratingHistory.length > 1 && (
              <div className="cc-card" style={{ padding: "14px 16px" }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 12 }}>Rating Journey</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48 }}>
                  {[...ratingHistory].reverse().map((e, i, arr) => {
                    const maxR = Math.max(...arr.map(x => x.rating))
                    const minR = Math.min(...arr.map(x => x.rating))
                    const range = maxR - minR || 1
                    const h = Math.max(8, Math.round(((e.rating - minR) / range) * 36) + 8)
                    const isLatest = i === arr.length - 1
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <div style={{
                          height: h, width: "100%", borderRadius: "3px 3px 0 0",
                          background: isLatest ? "#1B5E35" : "#E5E7EB",
                        }} />
                        {isLatest && (
                          <span style={{ fontSize: 9, color: "var(--green)", fontWeight: 600 }}>{e.rating}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Recent attendance ──────────────────── */}
            {attendance.length > 0 && (
              <div className="cc-card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "13px 16px 11px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>Recent Attendance</span>
                  <a href="/sessions" style={{ fontSize: 12, color: "var(--green)", textDecoration: "none", fontWeight: 500 }}>History</a>
                </div>
                {attendance.map((a, i) => {
                  const st = ATT[a.status] ?? { color: "#9CA3AF", label: a.status }
                  return (
                    <div key={i} style={{
                      padding: "10px 16px",
                      borderBottom: i < attendance.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: st.color }} />
                      <p style={{ flex: 1, fontSize: 13, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.sessions?.title ?? "Session"}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{fmtDateShort(a.sessions?.session_date)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "1px 7px",
                          borderRadius: 99, color: st.color,
                          background: `${st.color}14`,
                          border: `1px solid ${st.color}28`,
                        }}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Full menu ─────────────────────────── */}
            <div>
              <p className="cc-section-label">My Training Hub</p>
              <div className="cc-card" style={{ overflow: "hidden" }}>
                {[
                  { href: "/progress",    label: "XP & Level Progress", sub: `Level ${gp?.current_level ?? 1} · ${xpProgress}% to next`, icon: "⚡" },
                  { href: "/quests",      label: "Quest Map",            sub: "Active campaigns",                                          icon: "⚔" },
                  { href: "/guild",       label: "Guild",                sub: "Leaderboard & members",                                     icon: "👥" },
                  { href: "/tournaments", label: "Tournaments",          sub: "My registrations",                                          icon: "🏆" },
                  { href: "/performance", label: "Performance",          sub: "Rating history & Lichess",                                  icon: "📊" },
                  { href: "/gold-shop",   label: "Armory",               sub: "Spend your gold",                                          icon: "🪙" },
                ].map((item, i, arr) => (
                  <a key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "13px 16px",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: "var(--green-bg)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18,
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{item.label}</p>
                        <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 1 }}>{item.sub}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M9 18L15 12L9 6" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
