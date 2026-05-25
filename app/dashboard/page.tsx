"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
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
  current_level: number
  total_xp: number
  gold_balance: number
  streak_current: number
}

const STATUS_BG: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700",
  late:    "bg-amber-100 text-amber-700",
  excused: "bg-blue-100 text-blue-700",
  absent:  "bg-red-100 text-red-600",
}

const QUICK_LINKS = [
  { href: "/quests",       label: "Quest Map",    icon: "⚔️" },
  { href: "/puzzle-rush",  label: "Puzzle Rush",  icon: "⚡" },
  { href: "/duel",         label: "Friendly Duel",icon: "🤺" },
  { href: "/encounters",   label: "Boss Returns", icon: "👹" },
  { href: "/guild",        label: "Guild",        icon: "🏰" },
  { href: "/join-coach",   label: "Join a Coach", icon: "👨‍🏫" },
  { href: "/progress",     label: "XP & Level",   icon: "📊" },
  { href: "/gold-shop",    label: "The Armory",   icon: "🗡️" },
  { href: "/performance",  label: "Performance",  icon: "📈" },
  { href: "/sessions",     label: "Sessions",     icon: "📅" },
  { href: "/tournaments",  label: "Tournaments",  icon: "🏆" },
  { href: "/medical",      label: "Medical",      icon: "🏥" },
]

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

      // Update daily streak (idempotent — DB checks if already called today)
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
          .order("session_date").order("start_time").limit(5),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("attendance") as any)
          .select("status, sessions(title, session_date)")
          .eq("player_id", pl.id)
          .order("marked_at", { ascending: false }).limit(6),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_ratings_history") as any)
          .select("rating, recorded_at")
          .eq("player_id", pl.id)
          .order("recorded_at", { ascending: false }).limit(8),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles") as any)
          .select("current_level, total_xp, gold_balance, streak_current")
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

  const presentCount  = attendance.filter(a => a.status === "present").length
  const totalCount    = attendance.length
  const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null
  const firstName     = name?.split(" ")[0] ?? "Player"
  const ratingDelta   = ratingHistory.length >= 2
    ? ratingHistory[0].rating - ratingHistory[1].rating : null

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header style={{ background: "#0f172a", borderBottom: "1px solid rgba(16,185,129,0.15)" }}
        className="text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-lg" style={{ color: "#10b981" }}>ChessConnect</span>
        </div>
        <button onClick={handleSignOut} className="text-sm hover:text-white" style={{ color: "rgba(16,185,129,0.5)" }}>Sign out</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Welcome */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-stone-900">Welcome, {firstName} ♟</h1>
                <p className="text-sm text-stone-500 mt-0.5">
                  {player?.schools?.name ?? player?.clubs?.name ?? "Your chess journey"}
                  {player?.fide_id ? ` · FIDE ${player.fide_id}` : ""}
                </p>
              </div>
              {player?.fide_title && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 uppercase tracking-wider mt-1 shrink-0">
                  {player.fide_title}
                </span>
              )}
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Current Rating", value: player?.current_rating ?? "Unrated", delta: ratingDelta, color: "text-stone-900" },
                { label: "Attendance",     value: attendancePct != null ? `${attendancePct}%` : "—", delta: null, color: "text-stone-900" },
                { label: "Level",          value: gp ? `Lv. ${gp.current_level}` : "—", delta: null, color: "text-green-800" },
                { label: "Gold",           value: gp ? `${gp.gold_balance} 🪙` : "—", delta: null, color: "text-amber-600" },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{s.label}</p>
                  <div className="flex items-end gap-2 mt-1">
                    <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
                    {s.delta !== null && s.delta !== undefined && (
                      <span className={`text-xs font-bold mb-0.5 ${s.delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {s.delta >= 0 ? "+" : ""}{s.delta}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Streak banner */}
            {gp && gp.streak_current > 0 && (
              <div style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 16 }}
                className="px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="font-bold text-sm" style={{ color: "#f59e0b" }}>{gp.streak_current}-day streak!</p>
                  <p className="text-xs" style={{ color: "rgba(245,158,11,0.7)" }}>{gp.total_xp.toLocaleString()} XP total · Keep it going!</p>
                </div>
              </div>
            )}

            {/* Upcoming sessions */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                <h2 className="font-bold text-stone-800">Upcoming Sessions</h2>
                <a href="/sessions" className="text-xs text-amber-600 font-semibold">View all →</a>
              </div>
              {sessions.length === 0 ? (
                <div className="px-4 py-8 text-center text-stone-400 text-sm">No sessions scheduled</div>
              ) : (
                sessions.map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${i < sessions.length - 1 ? "border-b border-stone-50" : ""}`}>
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${s.status === "in_progress" ? "bg-green-900" : "bg-stone-100"}`}>
                      <span className={`text-[8px] font-bold uppercase ${s.status === "in_progress" ? "text-amber-400" : "text-stone-400"}`}>
                        {fmtWeekday(s.session_date)}
                      </span>
                      <span className={`text-base font-bold leading-none ${s.status === "in_progress" ? "text-white" : "text-stone-700"}`}>
                        {new Date(s.session_date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 truncate">{s.title}</p>
                      <p className="text-xs text-stone-400">
                        {s.start_time?.slice(0, 5)}{s.venue ? ` · ${s.venue}` : ""}
                      </p>
                    </div>
                    {s.status === "in_progress" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">Live</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Attendance history */}
            {attendance.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                  <h2 className="font-bold text-stone-800">Attendance History</h2>
                  {attendancePct !== null && (
                    <span className="text-xs text-stone-400">{attendancePct}% rate</span>
                  )}
                </div>
                {attendance.map((a, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < attendance.length - 1 ? "border-b border-stone-50" : ""}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{a.sessions?.title ?? "Session"}</p>
                      <p className="text-xs text-stone-400">
                        {fmtDateShort(a.sessions?.session_date)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_BG[a.status] ?? "bg-stone-100 text-stone-500"}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Rating history chart */}
            {ratingHistory.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-stone-100">
                  <h2 className="font-bold text-stone-800">Rating History</h2>
                </div>
                <div className="px-4 py-4">
                  <div className="flex items-end gap-1.5 h-20">
                    {[...ratingHistory].reverse().map((e, i, arr) => {
                      const prev  = arr[i - 1]
                      const delta = prev ? e.rating - prev.rating : null
                      const maxR  = Math.max(...arr.map(x => x.rating))
                      const minR  = Math.min(...arr.map(x => x.rating))
                      const range = maxR - minR || 1
                      const h     = Math.max(16, Math.round(((e.rating - minR) / range) * 60) + 16)
                      const isLatest = i === arr.length - 1
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className={`text-[8px] font-bold ${delta !== null ? (delta >= 0 ? "text-emerald-600" : "text-red-500") : "text-transparent"}`}>
                            {delta !== null ? (delta >= 0 ? `+${delta}` : `${delta}`) : "·"}
                          </span>
                          <div style={{ height: h }} className={`w-full rounded-t ${isLatest ? "bg-green-900" : "bg-stone-200"}`} />
                          <span className={`text-[8px] font-bold ${isLatest ? "text-stone-800" : "text-stone-400"}`}>{e.rating}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Quick links — all sidebar items */}
            <div>
              <h2 className="font-bold text-stone-700 text-xs uppercase tracking-wider mb-3 px-1">My Chess</h2>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_LINKS.map(l => (
                  <a key={l.href} href={l.href}
                    className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-2xl">{l.icon}</span>
                    <span className="text-sm font-semibold text-stone-800">{l.label}</span>
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
