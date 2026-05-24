"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

type Node = {
  id:               string
  title:            string
  node_type:        string
  position_order:   number
  xp_reward:        number
  gold_reward:      number
  is_locked:        boolean
  unlock_level?:    number | null
  difficulty_rating?: number | null
}

type Completion = { quest_node_id: string; status: string; xp_earned: number; gold_earned: number }

type Campaign = {
  id:            string
  title:         string
  cover_emoji?:  string | null
  description?:  string | null
  theme?:        string | null
  difficulty_from?: number | null
  difficulty_to?:   number | null
}

type Assignment = {
  id:          string
  campaign_id: string
  expires_at:  string | null
  quest_campaigns: Campaign | null
  nodes:       Node[]
  completions: Completion[]
}

const NODE_ICON: Record<string, string> = {
  quest:       "⚔️",
  boss:        "💀",
  boss_return: "👹",
  checkpoint:  "🏕️",
  treasure:    "💰",
  story:       "📜",
}

const NODE_COLOR: Record<string, string> = {
  quest:       "bg-blue-100 text-blue-700 border-blue-200",
  boss:        "bg-red-100 text-red-700 border-red-200",
  boss_return: "bg-orange-100 text-orange-700 border-orange-200",
  checkpoint:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  treasure:    "bg-amber-100 text-amber-700 border-amber-200",
  story:       "bg-stone-100 text-stone-600 border-stone-200",
}

export default function QuestsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [level,       setLevel]       = useState(1)
  const [gold,        setGold]        = useState(0)
  const [streak,      setStreak]      = useState(0)
  const [srDue,       setSrDue]       = useState(0)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()

      if (!player) { setLoading(false); return }

      const [gpRes, assignRes, srRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles") as any)
          .select("current_level, gold_balance, streak_current")
          .eq("player_id", player.id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_assignments") as any)
          .select("id, campaign_id, expires_at, quest_campaigns(id, title, cover_emoji, description, theme, difficulty_from, difficulty_to)")
          .eq("player_id", player.id).eq("status", "active"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sr_queue") as any)
          .select("id").eq("player_id", player.id).eq("is_active", true)
          .lte("due_date", new Date().toISOString().slice(0, 10)),
      ])

      setLevel(gpRes.data?.current_level ?? 1)
      setGold(gpRes.data?.gold_balance ?? 0)
      setStreak(gpRes.data?.streak_current ?? 0)
      setSrDue((srRes.data ?? []).length)

      const raw = assignRes.data ?? []
      const enriched: Assignment[] = await Promise.all(raw.map(async (a: {id: string; campaign_id: string; expires_at: string | null; quest_campaigns: Campaign | null}) => {
        const [nodesRes, compRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("quest_nodes") as any)
            .select("id, title, node_type, position_order, xp_reward, gold_reward, is_locked, unlock_level, difficulty_rating")
            .eq("campaign_id", a.campaign_id).order("position_order"),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("quest_completions") as any)
            .select("quest_node_id, status, xp_earned, gold_earned")
            .eq("player_id", player.id),
        ])
        return { ...a, nodes: nodesRes.data ?? [], completions: compRes.data ?? [] }
      }))

      setAssignments(enriched)
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-lg">Quest Map</span>
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
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "♚", label: "Level",  value: level       },
                { icon: "🪙", label: "Gold",   value: gold        },
                { icon: "🔥", label: "Streak", value: `${streak}d` },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-stone-200 p-3 text-center shadow-sm">
                  <span className="text-xl">{s.icon}</span>
                  <p className="text-base font-bold text-stone-900 mt-1">{s.value}</p>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Boss returns due */}
            {srDue > 0 && (
              <div className="bg-red-900 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-3xl">👹</span>
                <div>
                  <p className="text-white font-bold text-sm">Boss Returns Due!</p>
                  <p className="text-red-200 text-xs mt-0.5">{srDue} boss encounter{srDue > 1 ? "s" : ""} ready for your rematch</p>
                </div>
              </div>
            )}

            {/* Campaigns */}
            {assignments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-5xl">⚔️</span>
                <p className="mt-3 text-stone-600 font-bold">No active quests</p>
                <p className="text-sm text-stone-400 mt-1">Your coach will assign campaigns here.</p>
              </div>
            ) : (
              assignments.map(a => {
                const c = a.quest_campaigns
                const completed  = a.completions.filter(c => c.status === "completed").length
                const total      = a.nodes.length
                const pct        = total > 0 ? Math.round((completed / total) * 100) : 0
                const totalXp    = a.completions.reduce((s, c) => s + (c.xp_earned ?? 0), 0)
                const totalGold  = a.completions.reduce((s, c) => s + (c.gold_earned ?? 0), 0)
                const compSet    = new Set(a.completions.filter(c => c.status === "completed").map(c => c.quest_node_id))

                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                    {/* Campaign header */}
                    <div className="bg-green-900 px-4 py-4 flex items-center gap-3">
                      <span className="text-3xl flex-shrink-0">{c?.cover_emoji ?? "⚔️"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold truncate">{c?.title ?? "Campaign"}</p>
                        {c?.description && (
                          <p className="text-green-300 text-xs mt-0.5 line-clamp-1">{c.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-amber-400 text-xs font-bold">{completed}/{total}</p>
                        <p className="text-green-400 text-[10px]">nodes</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-stone-100">
                      <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    {/* Earned summary */}
                    {(totalXp > 0 || totalGold > 0) && (
                      <div className="flex items-center gap-4 px-4 py-2 bg-stone-50 border-b border-stone-100">
                        {totalXp > 0 && <span className="text-xs text-amber-700 font-semibold">+{totalXp} XP earned</span>}
                        {totalGold > 0 && <span className="text-xs text-amber-600 font-semibold">+{totalGold} 🪙 earned</span>}
                      </div>
                    )}

                    {/* Nodes */}
                    <div className="divide-y divide-stone-50">
                      {a.nodes.map((n, i) => {
                        const done     = compSet.has(n.id)
                        const locked   = n.is_locked && level < (n.unlock_level ?? 0)
                        const isCurrent = !done && !locked && i === a.nodes.findIndex(nd => !compSet.has(nd.id) && !(nd.is_locked && level < (nd.unlock_level ?? 0)))
                        return (
                          <div key={n.id} className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? "bg-amber-50" : ""}`}>
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm flex-shrink-0 ${
                              done ? "bg-emerald-100 border-emerald-200" :
                              locked ? "bg-stone-100 border-stone-200 opacity-50" :
                              isCurrent ? "bg-amber-100 border-amber-300" :
                              NODE_COLOR[n.node_type] ?? "bg-stone-100 border-stone-200"
                            }`}>
                              {done ? "✓" : locked ? "🔒" : NODE_ICON[n.node_type] ?? "❓"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${done ? "text-stone-400 line-through" : locked ? "text-stone-300" : "text-stone-800"}`}>
                                {n.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-stone-400 capitalize">{n.node_type.replace("_", " ")}</span>
                                {n.xp_reward > 0 && <span className="text-[10px] text-amber-600">+{n.xp_reward} XP</span>}
                                {n.gold_reward > 0 && <span className="text-[10px] text-amber-500">+{n.gold_reward}🪙</span>}
                              </div>
                            </div>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 shrink-0">Next</span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {a.expires_at && (
                      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100">
                        <p className="text-[10px] text-stone-400">
                          Expires {new Date(a.expires_at).toLocaleDateString("en-KE", { day:"numeric", month:"short" })}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
