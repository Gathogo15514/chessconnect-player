"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { getAvatar }           from "@/lib/avatars"
import type { AvatarId }       from "@/lib/avatars"
import { fmtDateShort, fmtWeekday } from "@/lib/dates"

type Player = {
  id: string; fide_id?: string | null; fide_title?: string | null
  current_rating?: number | null; school_id?: string | null; club_id?: string | null
  schools?: { name: string } | null; clubs?: { name: string } | null
}
type Session = {
  id: string; title: string; session_date: string
  start_time: string; status: string; venue?: string | null
}
type AttendanceRecord = {
  status: string; sessions?: { title: string; session_date: string } | null
}
type RatingEntry = { rating: number; recorded_at: string }
type GameProfile = {
  current_level: number; total_xp: number; gold_balance: number
  streak_current: number; level_xp_start: number; level_xp_threshold: number
  avatar_id?: string | null
}

function xpPct(total: number, start: number, threshold: number) {
  const range = threshold - start; const prog = total - start
  if (range <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((prog / range) * 100)))
}

const QUICK = [
  { href: "/quests",      label: "Quest Map",     icon: "⚔",  accent: "#FB923C" },
  { href: "/puzzle-rush", label: "Puzzle Rush",   icon: "⚡",  accent: "#E8C547" },
  { href: "/duel",        label: "Friendly Duel", icon: "🤺",  accent: "#F87171" },
  { href: "/encounters",  label: "Boss Returns",  icon: "☠",  accent: "#DC2626" },
  { href: "/guild",       label: "Guild",         icon: "♜",  accent: "#60A5FA" },
  { href: "/progress",    label: "XP & Level",    icon: "♛",  accent: "#A78BFA" },
  { href: "/gold-shop",   label: "Armory",        icon: "⚔",  accent: "#E8C547" },
  { href: "/performance", label: "Performance",   icon: "♟",  accent: "#22C55E" },
  { href: "/sessions",    label: "Sessions",      icon: "📅",  accent: "#60A5FA" },
  { href: "/tournaments", label: "Tournaments",   icon: "♚",  accent: "#E8C547" },
  { href: "/assignments", label: "Missions",      icon: "🎯",  accent: "#FB923C" },
  { href: "/profile",     label: "Profile",       icon: "♔",  accent: "#E8C547" },
]

const ATT_COLOR: Record<string, string> = {
  present: "#22C55E", late: "#F59E0B", excused: "#60A5FA", absent: "#F87171",
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
      supabase.rpc("update_player_streak", { p_player_id: pl.id }).then(() => {})
      const todayStr = new Date().toISOString().slice(0, 10)
      const in4w     = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10)
      const filters  = []
      if (pl.school_id) filters.push(`school_id.eq.${pl.school_id}`)
      if (pl.club_id)   filters.push(`club_id.eq.${pl.club_id}`)
      const orFilter = filters.length ? filters.join(",") : "id.eq.00000000-0000-0000-0000-000000000000"
      const [sessRes, attRes, ratingRes, gpRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sessions") as any).select("id, title, session_date, start_time, status, venue")
          .or(orFilter).gte("session_date", todayStr).lte("session_date", in4w)
          .order("session_date").order("start_time").limit(3),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("attendance") as any).select("status, sessions(title, session_date)")
          .eq("player_id", pl.id).order("marked_at", { ascending: false }).limit(4),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_ratings_history") as any).select("rating, recorded_at")
          .eq("player_id", pl.id).order("recorded_at", { ascending: false }).limit(8),
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

  const firstName   = name?.split(" ")[0] ?? "Player"
  const avatar      = getAvatar(gp?.avatar_id as AvatarId | undefined)
  const ratingDelta = ratingHistory.length >= 2 ? ratingHistory[0].rating - ratingHistory[1].rating : null
  const xpProgress  = gp ? xpPct(gp.total_xp, gp.level_xp_start, gp.level_xp_threshold) : 0

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 72 }}>
      <style>{`
        @keyframes cc-spin    { to { transform: rotate(360deg); } }
        @keyframes cc-shimmer { 0% { background-position:-300% center; } 100% { background-position:300% center; } }
        @keyframes cc-float   { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-6px); } }
        @keyframes cc-nav-active { 0%,100%{opacity:.9;} 50%{opacity:1;} }
        @keyframes cc-live    { 0%,100%{opacity:1;} 50%{opacity:.35;} }
      `}</style>

      {/* ── Topbar ───────────────────────────────────────── */}
      <header style={{
        padding: "16px 18px 12px",
        background: "rgba(9,9,11,0.95)",
        borderBottom: "1px solid rgba(232,197,71,0.1)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 40,
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "serif", fontSize: 22, color: "var(--gold)", filter: "drop-shadow(0 0 8px #E8C54780)" }}>♚</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)", letterSpacing: "0.08em" }}>
            CHESSCONNECT
          </span>
        </div>
        <button onClick={handleSignOut} style={{
          fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.08em",
          color: "var(--text-3)", background: "none", border: "none", cursor: "pointer",
        }}>
          SIGN OUT
        </button>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <div style={{ width: 36, height: 36, border: "3px solid var(--gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "cc-spin 0.9s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* ── Hero card ─────────────────────────────── */}
            <div style={{
              background: "var(--card)",
              border: "1px solid rgba(232,197,71,0.18)",
              borderRadius: 24,
              overflow: "hidden",
              position: "relative",
            }}>
              {/* Chess piece watermark */}
              <div style={{
                position: "absolute", right: -12, top: -12,
                fontFamily: "serif", fontSize: 120,
                color: "rgba(232,197,71,0.04)",
                lineHeight: 1, pointerEvents: "none", userSelect: "none",
                animation: "cc-float 5s ease-in-out infinite",
              }}>♚</div>

              <div style={{ padding: "20px 20px 16px" }}>
                {/* Player name + title */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: 16, flexShrink: 0,
                    background: `${avatar.color}18`,
                    border: `2px solid ${avatar.color}50`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 28,
                    animation: "cc-float 3.5s ease-in-out infinite",
                  }}>
                    {avatar.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", letterSpacing: "0.04em" }}>
                        {firstName.toUpperCase()}
                      </span>
                      {player?.fide_title && (
                        <span className="cc-badge-gold">{player.fide_title}</span>
                      )}
                    </div>
                    <p style={{ color: avatar.color, fontSize: 12, fontWeight: 500, marginTop: 1 }}>
                      {avatar.name} · {avatar.class}
                    </p>
                    <p style={{ color: "var(--text-3)", fontSize: 11, marginTop: 2 }}>
                      {player?.schools?.name ?? player?.clubs?.name ?? "Independent"}
                      {player?.fide_id ? ` · FIDE ${player.fide_id}` : ""}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
                  {[
                    { label: "RATING", value: player?.current_rating ? String(player.current_rating) : "—", delta: ratingDelta, color: "var(--gold)" },
                    { label: "LEVEL",  value: String(gp?.current_level ?? 1),      delta: null, color: "var(--purple)" },
                    { label: "STREAK", value: `${gp?.streak_current ?? 0}D`,        delta: null, color: "var(--orange)" },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${s.color}20`,
                      borderRadius: 14, padding: "10px 10px 8px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: s.color, lineHeight: 1 }}>
                        {s.value}
                        {s.delta !== null && (
                          <span style={{ fontSize: 12, color: s.delta >= 0 ? "var(--green)" : "var(--red)", marginLeft: 3 }}>
                            {s.delta >= 0 ? `+${s.delta}` : s.delta}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--text-3)", letterSpacing: "0.12em", marginTop: 4 }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* XP bar */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 9, color: "var(--text-3)", letterSpacing: "0.12em" }}>
                      LV {gp?.current_level ?? 1} → LV {(gp?.current_level ?? 1) + 1}
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 9, color: "var(--gold)", letterSpacing: "0.08em" }}>
                      {xpProgress}% · {(gp?.total_xp ?? 0).toLocaleString()} XP
                    </span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.max(2, xpProgress)}%`, height: "100%", borderRadius: 99,
                      background: "linear-gradient(90deg, #E8C547, #F59E0B, #E8C547)",
                      backgroundSize: "300% auto",
                      animation: "cc-shimmer 3s linear infinite",
                      boxShadow: "0 0 10px rgba(232,197,71,0.5)",
                    }} />
                  </div>
                </div>
              </div>

              {/* Gold streak banner */}
              {(gp?.streak_current ?? 0) > 0 && (
                <div style={{
                  borderTop: "1px solid rgba(232,197,71,0.1)",
                  padding: "10px 20px",
                  background: "rgba(232,197,71,0.04)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>🔥</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--gold)", letterSpacing: "0.06em" }}>
                      {gp!.streak_current}-DAY STREAK
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>keep it up!</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--gold)" }}>
                    {gp!.gold_balance.toLocaleString()} 🪙
                  </span>
                </div>
              )}
            </div>

            {/* ── Upcoming sessions ─────────────────────── */}
            {sessions.length > 0 && (
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text)", letterSpacing: "0.06em" }}>UPCOMING SESSIONS</span>
                  <a href="/sessions" style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--gold)", textDecoration: "none", letterSpacing: "0.08em" }}>
                    ALL →
                  </a>
                </div>
                {sessions.map((s, i) => {
                  const isLive = s.status === "in_progress"
                  return (
                    <div key={s.id} style={{
                      padding: "11px 18px",
                      borderBottom: i < sessions.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: isLive ? "rgba(232,197,71,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${isLive ? "rgba(232,197,71,0.3)" : "rgba(255,255,255,0.06)"}`,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 7, color: isLive ? "var(--gold)" : "var(--text-3)", letterSpacing: "0.1em" }}>
                          {fmtWeekday(s.session_date)}
                        </span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: isLive ? "var(--text)" : "var(--text-2)", lineHeight: 1 }}>
                          {new Date(s.session_date + "T00:00:00").getDate()}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</p>
                        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                          {s.start_time?.slice(0, 5)}{s.venue ? ` · ${s.venue}` : ""}
                        </p>
                      </div>
                      {isLive && (
                        <span style={{
                          fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.1em",
                          color: "var(--gold)", background: "rgba(232,197,71,0.1)",
                          border: "1px solid rgba(232,197,71,0.25)",
                          borderRadius: 99, padding: "3px 8px",
                          animation: "cc-live 1.2s ease-in-out infinite",
                        }}>
                          LIVE
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Rating spark ───────────────────────────── */}
            {ratingHistory.length > 1 && (
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "14px 18px" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 12 }}>
                  RATING HISTORY
                </p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 52 }}>
                  {[...ratingHistory].reverse().map((e, i, arr) => {
                    const prev = arr[i - 1]
                    const delta = prev ? e.rating - prev.rating : null
                    const maxR = Math.max(...arr.map(x => x.rating))
                    const minR = Math.min(...arr.map(x => x.rating))
                    const range = maxR - minR || 1
                    const h = Math.max(10, Math.round(((e.rating - minR) / range) * 38) + 10)
                    const isLatest = i === arr.length - 1
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 7, color: delta !== null ? (delta >= 0 ? "var(--green)" : "var(--red)") : "transparent", letterSpacing: "0.04em" }}>
                          {delta !== null ? (delta >= 0 ? `+${delta}` : `${delta}`) : "·"}
                        </span>
                        <div style={{
                          height: h, width: "100%", borderRadius: "3px 3px 0 0",
                          background: isLatest ? "var(--gold)" : "rgba(255,255,255,0.08)",
                          boxShadow: isLatest ? "0 0 8px rgba(232,197,71,0.4)" : "none",
                        }} />
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 7, color: isLatest ? "var(--gold)" : "var(--text-4)", letterSpacing: "0.04em" }}>
                          {e.rating}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Recent battles ─────────────────────────── */}
            {attendance.length > 0 && (
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text)", letterSpacing: "0.06em" }}>BATTLE LOG</span>
                </div>
                {attendance.map((a, i) => (
                  <div key={i} style={{
                    padding: "10px 18px",
                    borderBottom: i < attendance.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: ATT_COLOR[a.status] ?? "var(--text-3)",
                      boxShadow: `0 0 6px ${ATT_COLOR[a.status] ?? "var(--text-3)"}`,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.sessions?.title ?? "Session"}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>
                        {fmtDateShort(a.sessions?.session_date)}
                      </p>
                    </div>
                    <span style={{
                      fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.08em",
                      color: ATT_COLOR[a.status] ?? "var(--text-3)",
                      background: `${ATT_COLOR[a.status] ?? "var(--text-3)"}15`,
                      borderRadius: 99, padding: "3px 9px",
                      textTransform: "uppercase",
                    }}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Arsenal bento grid ─────────────────────── */}
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 12 }}>
                MY ARSENAL
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {QUICK.map(l => (
                  <a key={l.href} href={l.href} style={{
                    background: "var(--card)",
                    border: `1px solid ${l.accent}18`,
                    borderRadius: 16,
                    padding: "14px 14px",
                    display: "flex", alignItems: "center", gap: 10,
                    textDecoration: "none",
                    transition: "border-color 0.15s",
                  }}>
                    <span style={{
                      width: 36, height: 36,
                      background: `${l.accent}14`,
                      borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, flexShrink: 0,
                      fontFamily: l.icon.length === 1 && l.icon.charCodeAt(0) < 256 ? "serif" : "inherit",
                      color: l.accent,
                    }}>
                      {l.icon}
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-2)", letterSpacing: "0.04em", lineHeight: 1.2 }}>
                      {l.label.toUpperCase()}
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
