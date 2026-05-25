"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

const LEVEL_TITLES: Record<number, { title: string; emoji: string }> = {
  1:  { title: "Pawn",            emoji: "♟" },
  4:  { title: "Knight",          emoji: "♞" },
  7:  { title: "Bishop",          emoji: "♝" },
  10: { title: "Rook",            emoji: "♜" },
  15: { title: "Queen Initiate",  emoji: "♛" },
  20: { title: "Queen",           emoji: "♛" },
  25: { title: "King's Guard",    emoji: "♚" },
  30: { title: "Grand Tactician", emoji: "🏅" },
  40: { title: "Chess Champion",  emoji: "🏆" },
  50: { title: "Grandmaster",     emoji: "👑" },
}

function getLevelTitle(level: number) {
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a)
  const match = keys.find(k => level >= k)
  return match != null ? LEVEL_TITLES[match] : { title: "Pawn", emoji: "♟" }
}

function xpPercent(totalXp: number, levelStart: number, levelThreshold: number) {
  const range = levelThreshold - levelStart
  const prog  = totalXp - levelStart
  if (range <= 0) return 100
  return Math.min(100, Math.round((prog / range) * 100))
}

type GameProfile = {
  current_level:      number
  total_xp:           number
  gold_balance:       number
  streak_current:     number
  streak_shields:     number
  level_xp_start:     number
  level_xp_threshold: number
}

type QuestAssignment = {
  id:         string
  status:     string
  expires_at: string | null
  quest_campaigns?: {
    id:          string
    title:       string
    theme?:      string | null
    cover_emoji?: string | null
    description?: string | null
    difficulty_from?: number | null
    difficulty_to?:   number | null
  } | null
}

type XPEvent = {
  event_type: string
  xp_awarded: number
  created_at: string
  notes?:     string | null
}

export default function ProgressPage() {
  const router = useRouter()
  const [gp,       setGp]       = useState<GameProfile | null>(null)
  const [quests,   setQuests]   = useState<QuestAssignment[]>([])
  const [xpLog,    setXpLog]    = useState<XPEvent[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()

      if (!player) { setLoading(false); return }

      const [gpRes, questRes, xpRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles") as any)
          .select("current_level, total_xp, gold_balance, streak_current, streak_shields, level_xp_start, level_xp_threshold")
          .eq("player_id", player.id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_assignments") as any)
          .select("id, status, expires_at, quest_campaigns(id, title, theme, cover_emoji, description, difficulty_from, difficulty_to)")
          .eq("player_id", player.id).eq("status", "active").limit(6),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_xp_events") as any)
          .select("event_type, xp_awarded, created_at, notes")
          .eq("player_id", player.id)
          .order("created_at", { ascending: false }).limit(10),
      ])

      setGp(gpRes.data ?? null)
      setQuests(questRes.data ?? [])
      setXpLog(xpRes.data ?? [])
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const level       = gp?.current_level ?? 1
  const totalXp     = gp?.total_xp ?? 0
  const gold        = gp?.gold_balance ?? 0
  const streak      = gp?.streak_current ?? 0
  const shields     = gp?.streak_shields ?? 0
  const levelStart  = gp?.level_xp_start ?? 0
  const levelThresh = gp?.level_xp_threshold ?? 100
  const xpPct       = xpPercent(totalXp, levelStart, levelThresh)
  const levelTitle  = getLevelTitle(level)

  const XP_LABEL: Record<string, string> = {
    quest_complete:    "Quest Complete",
    quest_perfect:     "Perfect Clear",
    boss_defeated:     "Boss Defeated",
    session_attended:  "Session Attended",
    streak_bonus:      "Streak Bonus",
    tournament_played: "Tournament Played",
    tournament_win:    "Tournament Win",
    coach_award:       "Coach Award",
    rating_milestone:  "Rating Milestone",
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-lg">My Progress</span>
        </div>
        <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white">Sign out</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Hero card */}
            <div className="bg-green-900 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white opacity-5 -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-amber-400/20 border-2 border-amber-400/50 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-3xl leading-none">{levelTitle.emoji}</span>
                </div>
                <div className="flex-1">
                  <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">{levelTitle.title}</p>
                  <p className="text-white text-2xl font-bold">Level {level}</p>
                  <p className="text-green-300 text-xs mt-0.5">{totalXp.toLocaleString()} XP total</p>
                </div>
              </div>

              {/* XP bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-green-300 mb-1">
                  <span>Progress to Level {level + 1}</span>
                  <span>{xpPct}%</span>
                </div>
                <div className="h-2.5 bg-green-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-green-400 mt-1">
                  <span>{levelStart.toLocaleString()} XP</span>
                  <span>{levelThresh.toLocaleString()} XP</span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Gold",   value: gold.toLocaleString(),        icon: "🪙" },
                { label: "Streak", value: `${streak} days`,             icon: "🔥" },
                { label: "Shields",value: shields.toString(),           icon: "🛡" },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-stone-200 p-3 text-center shadow-sm">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-lg font-bold text-stone-900 mt-1">{s.value}</p>
                  <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Active quests */}
            {quests.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-stone-100">
                  <h2 className="font-bold text-stone-800">Active Quests</h2>
                </div>
                {quests.map((q, i) => {
                  const c = q.quest_campaigns
                  return (
                    <div key={q.id} className={`px-4 py-3 flex items-center gap-3 ${i < quests.length - 1 ? "border-b border-stone-50" : ""}`}>
                      <span className="text-2xl flex-shrink-0">{c?.cover_emoji ?? "⚔️"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-800 truncate">{c?.title ?? "Quest"}</p>
                        {c?.description && (
                          <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">{c.description}</p>
                        )}
                        {q.expires_at && (
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            Expires {new Date(q.expires_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">Active</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* XP history */}
            {xpLog.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-stone-100">
                  <h2 className="font-bold text-stone-800">XP History</h2>
                </div>
                {xpLog.map((e, i) => (
                  <div key={i} className={`px-4 py-2.5 flex items-center justify-between gap-3 ${i < xpLog.length - 1 ? "border-b border-stone-50" : ""}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-800">{XP_LABEL[e.event_type] ?? e.event_type}</p>
                      {e.notes && <p className="text-xs text-stone-400 mt-0.5 truncate">{e.notes}</p>}
                      <p className="text-[10px] text-stone-400">
                        {new Date(e.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-amber-600 shrink-0">+{e.xp_awarded} XP</span>
                  </div>
                ))}
              </div>
            )}

            {!gp && (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-4xl">📊</span>
                <p className="mt-3 text-stone-600 font-medium">No progress data yet</p>
                <p className="text-sm text-stone-400 mt-1">Complete puzzles and attend sessions to earn XP and level up.</p>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
