"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { getAvatar }           from "@/lib/avatars"
import type { AvatarId }       from "@/lib/avatars"
import { fmtDateShort, fmtWeekday } from "@/lib/dates"

// ── Types ──────────────────────────────────────────────────────────────────────
type Player = {
  id: string; fide_id?: string|null; fide_title?: string|null
  current_rating?: number|null; school_id?: string|null; club_id?: string|null
  schools?: { name: string }|null; clubs?: { name: string }|null
}
type Session = {
  id: string; title: string; session_date: string
  start_time: string; status: string; venue?: string|null
  coaches?: { profiles?: { full_name?: string|null }|null }|null
}
type AttendanceRecord = {
  status: string; sessions?: { title: string; session_date: string }|null
}
type RatingEntry = { rating: number; recorded_at: string }
type GameProfile = {
  current_level: number; total_xp: number; gold_balance: number
  streak_current: number; streak_shields: number
  level_xp_start: number; level_xp_threshold: number
  avatar_id?: string|null
}
type ActiveQuest = {
  id: string; campaign_id: string
  quest_campaigns: {
    id: string; title: string; cover_emoji?: string|null
    quest_nodes?: { id: string }[]
  }|null
}
type XpEvent = { event_type: string; xp_awarded: number; created_at: string; notes?: string|null }
type FeedItem = { icon: string; label: string; xp?: number; time: string }

// ── Level system ───────────────────────────────────────────────────────────────
const LEVELS: Record<number, { title: string; emoji: string }> = {
  1:  { title: "Pawn",            emoji: "♟" },
  4:  { title: "Knight",          emoji: "♞" },
  7:  { title: "Bishop",          emoji: "♝" },
  10: { title: "Rook",            emoji: "♜" },
  15: { title: "Queen",           emoji: "♛" },
  25: { title: "King's Guard",    emoji: "♚" },
  30: { title: "Grand Tactician", emoji: "🏅" },
  50: { title: "Grandmaster",     emoji: "♔" },
}
function getTitle(l: number) {
  const k = Object.keys(LEVELS).map(Number).sort((a, b) => b - a).find(k => l >= k)
  return k != null ? LEVELS[k] : { title: "Pawn", emoji: "♟" }
}

// ── XP event labels & icons ────────────────────────────────────────────────────
const XP_ICONS: Record<string, string> = {
  quest_complete:   "⚔️",
  quest_perfect:    "✨",
  boss_defeated:    "💀",
  session_attended: "📅",
  streak_bonus:     "🔥",
  tournament_played:"🏆",
  tournament_win:   "🥇",
  coach_award:      "🎖️",
  rating_milestone: "📈",
  puzzle_rush:      "⚡",
}
const XP_LABELS: Record<string, string> = {
  quest_complete:   "Quest Complete",
  quest_perfect:    "Perfect Clear",
  boss_defeated:    "Boss Defeated",
  session_attended: "Session Attended",
  streak_bonus:     "Streak Bonus",
  tournament_played:"Tournament Played",
  tournament_win:   "Tournament Win",
  coach_award:      "Coach Award",
  rating_milestone: "Rating Milestone",
  puzzle_rush:      "Puzzle Rush",
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function xpPct(total: number, start: number, threshold: number) {
  const r = threshold - start, p = total - start
  if (r <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((p / r) * 100)))
}
function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2)  return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "Yesterday"
  if (days < 7)  return `${days} days ago`
  return fmtDateShort(iso.slice(0, 10))
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [name,          setName]          = useState<string|null>(null)
  const [player,        setPlayer]        = useState<Player|null>(null)
  const [gp,            setGp]            = useState<GameProfile|null>(null)
  const [sessions,      setSessions]      = useState<Session[]>([])
  const [attendance,    setAttendance]    = useState<AttendanceRecord[]>([])
  const [ratingHistory, setRatingHistory] = useState<RatingEntry[]>([])
  const [activeQuest,   setActiveQuest]   = useState<ActiveQuest|null>(null)
  const [completedIds,  setCompletedIds]  = useState<Set<string>>(new Set())
  const [xpEvents,      setXpEvents]      = useState<XpEvent[]>([])
  const [srDue,         setSrDue]         = useState(0)
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
      const f = [pl.school_id && `school_id.eq.${pl.school_id}`, pl.club_id && `club_id.eq.${pl.club_id}`]
        .filter(Boolean).join(",") || "id.eq.00000000-0000-0000-0000-000000000000"

      const [sR, aR, rR, gR, qaR, xpR, srR] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sessions") as any)
          .select("id, title, session_date, start_time, status, venue, coaches(profiles(full_name))")
          .or(f).gte("session_date", today).lte("session_date", in4w)
          .order("session_date").order("start_time").limit(2),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("attendance") as any)
          .select("status, sessions(title, session_date)")
          .eq("player_id", pl.id).order("marked_at", { ascending: false }).limit(5),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_ratings_history") as any)
          .select("rating, recorded_at")
          .eq("player_id", pl.id).order("recorded_at", { ascending: false }).limit(7),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles") as any)
          .select("current_level, total_xp, gold_balance, streak_current, streak_shields, level_xp_start, level_xp_threshold, avatar_id")
          .eq("player_id", pl.id).maybeSingle(),
        // Active quest assignment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_assignments") as any)
          .select("id, campaign_id, quest_campaigns(id, title, cover_emoji, quest_nodes(id))")
          .eq("player_id", pl.id).eq("status", "active").limit(1),
        // XP events for activity feed + daily mission checks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_xp_events") as any)
          .select("event_type, xp_awarded, created_at, notes")
          .eq("player_id", pl.id).order("created_at", { ascending: false }).limit(8),
        // SR boss returns due today
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sr_queue") as any)
          .select("id").eq("player_id", pl.id).eq("is_active", true).lte("due_date", today),
      ])

      setSessions(sR.data ?? [])
      setAttendance(aR.data ?? [])
      setRatingHistory(rR.data ?? [])
      setGp(gR.data ?? null)
      const qa = qaR.data?.[0] ?? null
      setActiveQuest(qa)
      if (qa) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compR = await (supabase.from("quest_completions") as any)
          .select("quest_node_id").eq("player_id", pl.id).eq("status", "completed")
        setCompletedIds(new Set((compR.data ?? []).map((c: { quest_node_id: string }) => c.quest_node_id)))
      }
      setXpEvents(xpR.data ?? [])
      setSrDue((srR.data ?? []).length)
      setLoading(false)
    })
  }, [router])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const firstName     = name?.split(" ")[0] ?? "Player"
  const lastName      = name?.split(" ").slice(1).join(" ") ?? ""
  const avatar        = getAvatar(gp?.avatar_id as AvatarId | undefined)
  const ratingDelta   = ratingHistory.length >= 2 ? ratingHistory[0].rating - ratingHistory[1].rating : null
  const xpProgress    = gp ? xpPct(gp.total_xp, gp.level_xp_start, gp.level_xp_threshold) : 0
  const org           = player?.schools?.name ?? player?.clubs?.name ?? null
  const lvl           = gp?.current_level ?? 1
  const currentTitle  = getTitle(lvl)
  const nextLvl       = lvl + 1
  const nextTitle     = getTitle(nextLvl)
  const xpToNext      = gp ? Math.max(0, gp.level_xp_threshold - gp.total_xp) : 0

  // Continue Training
  const totalNodes     = activeQuest?.quest_campaigns?.quest_nodes?.length ?? 0
  const completedCount = activeQuest
    ? (activeQuest.quest_campaigns?.quest_nodes ?? []).filter(n => completedIds.has(n.id)).length
    : 0
  const questPct = totalNodes > 0 ? Math.round((completedCount / totalNodes) * 100) : 0

  // Daily missions
  const today = new Date().toISOString().slice(0, 10)
  const solvedToday = xpEvents.some(e =>
    (e.event_type === "quest_complete" || e.event_type === "boss_defeated") && e.created_at.startsWith(today)
  )
  const attendedToday = attendance.some(a =>
    a.sessions?.session_date === today && (a.status === "present" || a.status === "late")
  )
  const missions = [
    { label: "Log in today",    done: true,          icon: "🌅" },
    { label: "Solve a puzzle",  done: solvedToday,   icon: "⚔️" },
    { label: "Attend training", done: attendedToday, icon: "📅" },
  ]
  const missionsDone = missions.filter(m => m.done).length

  // Activity feed: merge XP events + attendance records, sort newest-first
  const feedItems: FeedItem[] = [
    ...xpEvents.map(e => ({
      icon:  XP_ICONS[e.event_type] ?? "⚡",
      label: XP_LABELS[e.event_type] ?? e.event_type,
      xp:    e.xp_awarded,
      time:  e.created_at,
    })),
    ...attendance
      .filter(a => a.sessions?.session_date)
      .map(a => ({
        icon:  a.status === "present" ? "✅" : a.status === "late" ? "🕐" : "❌",
        label: a.sessions?.title ?? "Session",
        xp:    undefined,
        time:  `${a.sessions!.session_date}T12:00:00Z`,
      })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5)

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        @keyframes cc-spin{to{transform:rotate(360deg)}}
        @keyframes cc-shimmer{0%{background-position:-400% center}100%{background-position:400% center}}
      `}</style>

      {/* ══ SECTION 1: HERO ══════════════════════════════════════════════════ */}
      <header style={{ background: "#1B5E35", padding: "18px 18px 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)", backgroundSize: "24px 24px" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Top row: avatar + name + settings */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Avatar with glow */}
            <a href="/profile" style={{ textDecoration: "none", flexShrink: 0 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: loading ? "rgba(255,255,255,0.12)" : `${avatar.color}33`,
                border: `2.5px solid ${loading ? "rgba(255,255,255,0.3)" : avatar.color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28,
                boxShadow: loading ? "none" : `0 0 18px ${avatar.glow ?? avatar.color + "55"}`,
              }}>
                {!loading && avatar.emoji}
              </div>
            </a>

            {/* Name + rank + org */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ width: 150, height: 38, background: "rgba(255,255,255,0.1)", borderRadius: 8 }} />
              ) : (
                <>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>{getGreeting()},</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1, letterSpacing: "0.03em", color: "#fff", margin: 0 }}>
                      {firstName.toUpperCase()}{lastName ? ` ${lastName.toUpperCase()}` : ""}
                    </h1>
                    {player?.fide_title && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#FCD34D", background: "rgba(252,211,77,0.15)", padding: "2px 7px", borderRadius: 5, border: "1px solid rgba(252,211,77,0.3)" }}>
                        {player.fide_title}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>
                    {currentTitle.emoji} {currentTitle.title}{org ? ` · ${org}` : ""}
                  </p>
                </>
              )}
            </div>

            {/* Settings icon */}
            <a href="/profile" style={{ flexShrink: 0, opacity: 0.55, textDecoration: "none" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="2"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#fff" strokeWidth="2"/>
              </svg>
            </a>
          </div>

          {/* Stats chips */}
          {!loading && (
            <div style={{ display: "flex", gap: 7, marginTop: 14, flexWrap: "wrap" }}>
              {[
                { icon: "★", value: player?.current_rating ? String(player.current_rating) : "—", suffix: ratingDelta !== null ? (ratingDelta >= 0 ? `+${ratingDelta}` : String(ratingDelta)) : null, suffixColor: ratingDelta !== null ? (ratingDelta >= 0 ? "#86EFAC" : "#FCA5A5") : null },
                { icon: currentTitle.emoji, value: `Lv.${lvl}`, suffix: null, suffixColor: null },
                { icon: "🔥", value: `${gp?.streak_current ?? 0}d`, suffix: null, suffixColor: null },
                { icon: "🪙", value: `${(gp?.gold_balance ?? 0).toLocaleString()}`, suffix: null, suffixColor: null },
              ].map((s, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 99, padding: "5px 11px", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12 }}>{s.icon}</span>
                  <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{s.value}</span>
                  {s.suffix && <span style={{ fontSize: 10, color: s.suffixColor ?? "#fff", fontWeight: 600 }}>{s.suffix}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "14px 14px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 64 }}>
            <div style={{ width: 32, height: 32, border: "3px solid #1B5E35", borderTopColor: "transparent", borderRadius: "50%", animation: "cc-spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* ══ SECTION 2: DAILY MISSIONS ═══════════════════════════════════ */}
            <div className="cc-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "13px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text)", letterSpacing: "0.06em" }}>⚡ DAILY TRAINING</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {missions.map((_, i) => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < missionsDone ? "var(--green)" : "var(--border-med)" }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>{missionsDone}/{missions.length}</span>
                  <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>+{missionsDone * 15}🪙</span>
                </div>
              </div>
              <div style={{ padding: "6px 0 4px" }}>
                {missions.map((m, i) => (
                  <div key={i} style={{ padding: "9px 16px", display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: m.done ? "var(--green)" : "var(--surface-2)",
                      border: `2px solid ${m.done ? "var(--green)" : "var(--border-med)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {m.done && (
                        <svg width="11" height="11" viewBox="0 0 12 12">
                          <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{m.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, flex: 1, color: m.done ? "var(--text-3)" : "var(--text)", textDecoration: m.done ? "line-through" : "none" }}>
                      {m.label}
                    </span>
                    {!m.done && <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>+15🪙</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* ══ SECTION 3: CONTINUE TRAINING ════════════════════════════════ */}
            {activeQuest ? (
              <a href="/quests" style={{ textDecoration: "none" }}>
                <div className="cc-card-press" style={{
                  background: "var(--green-bg)",
                  border: "1px solid var(--green-mid)",
                  borderLeft: "4px solid var(--green)",
                  borderRadius: 16, padding: "15px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--green)", letterSpacing: "0.12em", marginBottom: 5 }}>CONTINUE TRAINING</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {activeQuest.quest_campaigns?.cover_emoji ?? "⚔️"} {activeQuest.quest_campaigns?.title ?? "Active Campaign"}
                      </p>
                      <div style={{ marginTop: 10, height: 7, background: "var(--green-mid)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${Math.max(4, questPct)}%`, height: "100%", background: "var(--green)", borderRadius: 99 }} />
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 5 }}>
                        {completedCount}/{totalNodes} nodes · {questPct}% complete
                      </p>
                    </div>
                    <div style={{ background: "var(--green)", borderRadius: 10, padding: "9px 14px", flexShrink: 0, alignSelf: "center" }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "#fff", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>RESUME →</p>
                    </div>
                  </div>
                </div>
              </a>
            ) : (
              <a href="/quests" style={{ textDecoration: "none" }}>
                <div className="cc-card-press" style={{ background: "var(--surface)", border: "1px dashed var(--border-med)", borderRadius: 16, padding: "15px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 5 }}>START YOUR JOURNEY</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Choose a learning path</p>
                    <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>Openings · Tactics · Endgames</p>
                  </div>
                  <span style={{ fontSize: 32 }}>📚</span>
                  <div style={{ background: "var(--green)", borderRadius: 10, padding: "9px 12px", flexShrink: 0 }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "#fff", letterSpacing: "0.06em" }}>BROWSE →</p>
                  </div>
                </div>
              </a>
            )}

            {/* ══ SECTION 4: XP & LEVEL ═══════════════════════════════════════ */}
            <div className="cc-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text)", letterSpacing: "0.04em", lineHeight: 1 }}>
                      LEVEL {lvl} · {currentTitle.title.toUpperCase()}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                      {xpToNext.toLocaleString()} XP to Level {nextLvl} — {nextTitle.title}
                    </p>
                  </div>
                  <a href="/progress" style={{ fontSize: 11, color: "var(--green)", fontWeight: 600, textDecoration: "none", marginTop: 2 }}>Progress ›</a>
                </div>
                <div style={{ height: 10, background: "#E5E7EB", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{
                    width: `${Math.max(2, xpProgress)}%`, height: "100%", borderRadius: 99,
                    background: "linear-gradient(90deg, #1B5E35, #2E7D50, #1B5E35)",
                    backgroundSize: "400% auto", animation: "cc-shimmer 3s linear infinite",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>{(gp?.total_xp ?? 0).toLocaleString()} XP total</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)" }}>{xpProgress}%</span>
                </div>
              </div>
              {/* Streak + shields */}
              <div style={{ borderTop: "1px solid var(--border)", padding: "11px 16px", display: "flex", alignItems: "center", gap: 16, background: "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🔥</span>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{gp?.streak_current ?? 0}</p>
                    <p style={{ fontSize: 10, color: "var(--text-3)" }}>day streak</p>
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: "var(--border)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🛡</span>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{gp?.streak_shields ?? 0}</p>
                    <p style={{ fontSize: 10, color: "var(--text-3)" }}>shields</p>
                  </div>
                </div>
                {xpEvents.length > 0 && (
                  <>
                    <div style={{ width: 1, height: 28, background: "var(--border)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: "var(--green)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        +{xpEvents[0].xp_awarded} XP · {XP_LABELS[xpEvents[0].event_type] ?? xpEvents[0].event_type}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--text-3)" }}>{relTime(xpEvents[0].created_at)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ══ SECTION 5: BOSS RETURNS ALERT (conditional) ════════════════ */}
            {srDue > 0 && (
              <a href="/encounters" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "linear-gradient(135deg, #450a0a, #7f1d1d)",
                  borderRadius: 14, padding: "13px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <span style={{ fontSize: 26 }}>👹</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#fff", letterSpacing: "0.04em" }}>
                      {srDue} BOSS RETURN{srDue > 1 ? "S" : ""} DUE!
                    </p>
                    <p style={{ fontSize: 11, color: "#fca5a5", marginTop: 2 }}>Your defeated bosses want a rematch</p>
                  </div>
                  <div style={{ background: "#DC2626", borderRadius: 8, padding: "7px 12px", flexShrink: 0 }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "#fff", letterSpacing: "0.06em" }}>FIGHT →</p>
                  </div>
                </div>
              </a>
            )}

            {/* ══ SECTION 6: NEXT SESSIONS ════════════════════════════════════ */}
            {sessions.length > 0 && (
              <div className="cc-card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "13px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text)", letterSpacing: "0.06em" }}>📅 NEXT SESSIONS</span>
                  <a href="/sessions" style={{ fontSize: 12, color: "var(--green)", textDecoration: "none", fontWeight: 500 }}>See all</a>
                </div>
                {sessions.map((s, i) => {
                  const isLive    = s.status === "in_progress"
                  const isTodayS  = s.session_date === today
                  const isTomorrow = s.session_date === new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                  const dateLabel = isLive ? "LIVE" : isTodayS ? "TODAY" : isTomorrow ? "TMRW" : `${fmtWeekday(s.session_date)} ${new Date(s.session_date + "T00:00:00").getDate()}`
                  const coachName = s.coaches?.profiles?.full_name
                  return (
                    <div key={s.id} style={{
                      padding: "12px 16px",
                      borderBottom: i < sessions.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{
                        minWidth: 52, height: 44, borderRadius: 10, flexShrink: 0,
                        background: isLive ? "#1B5E35" : isTodayS ? "rgba(27,94,53,0.1)" : "var(--surface-2)",
                        border: `1.5px solid ${isLive || isTodayS ? "var(--green)" : "var(--border)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px",
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: isLive ? "#fff" : isTodayS ? "var(--green)" : "var(--text-3)", textAlign: "center", letterSpacing: "0.04em" }}>
                          {dateLabel}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</p>
                        <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 1 }}>
                          {s.start_time?.slice(0, 5)}{coachName ? ` · ${coachName}` : s.venue ? ` · ${s.venue}` : ""}
                        </p>
                      </div>
                      {isLive ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                          <span className="cc-live-dot" />
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#16A34A" }}>Live</span>
                        </div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M9 18L15 12L9 6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ══ SECTION 7: QUICK BATTLE ══════════════════════════════════════ */}
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--text-3)", letterSpacing: "0.12em", marginBottom: 10, paddingLeft: 2 }}>PLAY</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <a href="/puzzle-rush" style={{ textDecoration: "none" }}>
                  <div className="cc-card cc-card-press" style={{ padding: "15px 14px", borderTop: "3px solid var(--gold)" }}>
                    <span style={{ fontSize: 26 }}>⚡</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text)", letterSpacing: "0.04em", marginTop: 8, lineHeight: 1 }}>PUZZLE RUSH</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5, lineHeight: 1.4 }}>Solve as many as you can in 3 minutes</p>
                    <div style={{ marginTop: 10, display: "inline-flex", background: "var(--gold)", borderRadius: 7, padding: "5px 11px" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "#fff", letterSpacing: "0.06em" }}>START</span>
                    </div>
                  </div>
                </a>
                <a href="/duel" style={{ textDecoration: "none" }}>
                  <div className="cc-card cc-card-press" style={{ padding: "15px 14px", borderTop: "3px solid var(--green)" }}>
                    <span style={{ fontSize: 26 }}>⚔️</span>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text)", letterSpacing: "0.04em", marginTop: 8, lineHeight: 1 }}>DUEL</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5, lineHeight: 1.4 }}>Challenge a guildmate to live chess</p>
                    <div style={{ marginTop: 10, display: "inline-flex", background: "var(--green)", borderRadius: 7, padding: "5px 11px" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "#fff", letterSpacing: "0.06em" }}>PLAY</span>
                    </div>
                  </div>
                </a>
              </div>
              {/* Secondary link pills */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { href: "/assignments",  label: "Missions",    icon: "🎯" },
                  { href: "/tournaments",  label: "Tournaments", icon: "🏆" },
                  { href: "/sessions",     label: "Sessions",    icon: "📅" },
                  { href: "/guild",        label: "Guild",       icon: "👥" },
                ].map(a => (
                  <a key={a.href} href={a.href} style={{ textDecoration: "none" }}>
                    <div className="cc-card cc-card-press" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{a.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{a.label}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* ══ SECTION 8: RECENT ACTIVITY ══════════════════════════════════ */}
            {feedItems.length > 0 && (
              <div className="cc-card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "13px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text)", letterSpacing: "0.06em" }}>📋 RECENT ACTIVITY</span>
                  <a href="/progress" style={{ fontSize: 12, color: "var(--green)", textDecoration: "none", fontWeight: 500 }}>Full history</a>
                </div>
                {feedItems.map((f, i) => (
                  <div key={i} style={{
                    padding: "10px 16px",
                    borderBottom: i < feedItems.length - 1 ? "1px solid var(--border)" : "none",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{f.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</p>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>{relTime(f.time)}</p>
                    </div>
                    {f.xp !== undefined && f.xp > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", flexShrink: 0 }}>+{f.xp} XP</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ══ SECTION 9: RATING JOURNEY ═══════════════════════════════════ */}
            {ratingHistory.length > 1 && (
              <div className="cc-card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--text)", letterSpacing: "0.06em" }}>📈 RATING JOURNEY</span>
                  <a href="/performance" style={{ fontSize: 12, color: "var(--green)", fontWeight: 500, textDecoration: "none" }}>Full stats ›</a>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 52 }}>
                  {[...ratingHistory].reverse().map((e, i, arr) => {
                    const maxR = Math.max(...arr.map(x => x.rating))
                    const minR = Math.min(...arr.map(x => x.rating))
                    const range = maxR - minR || 1
                    const h = Math.max(8, Math.round(((e.rating - minR) / range) * 40) + 8)
                    const isLatest = i === arr.length - 1
                    const prev = arr[i - 1]
                    const delta = prev ? e.rating - prev.rating : null
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        {delta !== null && (
                          <span style={{ fontSize: 8, fontWeight: 700, color: delta >= 0 ? "#16A34A" : "var(--red)" }}>
                            {delta >= 0 ? `+${delta}` : delta}
                          </span>
                        )}
                        <div style={{ height: h, width: "100%", borderRadius: "3px 3px 0 0", background: isLatest ? "#1B5E35" : "#E5E7EB" }} />
                        {isLatest && <span style={{ fontSize: 9, color: "var(--green)", fontWeight: 700 }}>{e.rating}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
