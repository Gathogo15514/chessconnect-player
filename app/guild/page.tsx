"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

type Member = {
  player_id:     string
  full_name:     string
  current_level: number
  total_xp:      number
  streak_current:number
  gold_balance:  number
}

type GuildInfo = {
  name:      string
  type:      "school" | "club"
  emoji:     string
  total_xp:  number
  members:   Member[]
}

const RANK_MEDALS = ["🥇","🥈","🥉"]

export default function GuildPage() {
  const router = useRouter()
  const [guild,   setGuild]   = useState<GuildInfo | null>(null)
  const [myId,    setMyId]    = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<"leaderboard" | "info">("leaderboard")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id, school_id, club_id, schools(name), clubs(name)")
        .eq("profile_id", session.user.id).maybeSingle()

      if (!player) { setLoading(false); return }
      setMyId(player.id)

      // Determine guild (school takes priority)
      const guildId   = player.school_id ?? player.club_id
      const guildType: "school"|"club" = player.school_id ? "school" : "club"
      const guildName = (player.schools?.name ?? player.clubs?.name) as string | null

      if (!guildId) { setLoading(false); return }

      // Fetch all members in the same org
      const filter = guildType === "school" ? "school_id" : "club_id"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: players } = await (supabase.from("players") as any)
        .select("id, profile_id").eq(filter, guildId).limit(100)

      if (!players?.length) { setLoading(false); return }

      const playerIds: string[] = players.map((p: { id: string }) => p.id)
      const profileIds: string[] = players.map((p: { profile_id: string }) => p.profile_id)

      const [gpRes, profileRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles") as any)
          .select("player_id, current_level, total_xp, streak_current, gold_balance")
          .in("player_id", playerIds),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("profiles") as any)
          .select("id, full_name").in("id", profileIds),
      ])

      const profileMap: Record<string, string> = {}
      for (const pr of (profileRes.data ?? [])) {
        profileMap[pr.id] = pr.full_name
      }
      const playerProfileMap: Record<string, string> = {}
      for (const pl of players) {
        playerProfileMap[pl.id] = pl.profile_id
      }

      const members: Member[] = (gpRes.data ?? []).map((gp: {
        player_id: string; current_level: number; total_xp: number;
        streak_current: number; gold_balance: number
      }) => ({
        player_id:      gp.player_id,
        full_name:      profileMap[playerProfileMap[gp.player_id]] ?? "Player",
        current_level:  gp.current_level,
        total_xp:       gp.total_xp,
        streak_current: gp.streak_current,
        gold_balance:   gp.gold_balance,
      })).sort((a: Member, b: Member) => b.total_xp - a.total_xp)

      const total_xp = members.reduce((s: number, m: Member) => s + m.total_xp, 0)

      setGuild({
        name:    guildName ?? (guildType === "school" ? "My School" : "My Club"),
        type:    guildType,
        emoji:   guildType === "school" ? "🏫" : "♟️",
        total_xp,
        members,
      })
      setLoading(false)
    })
  }, [router])

  const myRank = guild?.members.findIndex(m => m.player_id === myId) ?? -1

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0f172a" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #0f172a, #1e1b4b)", borderBottom: "1px solid rgba(59,130,246,0.2)" }}
        className="px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">{guild?.emoji ?? "⚔️"}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{guild?.name ?? "Guild"}</p>
          <p className="text-xs" style={{ color: "rgba(59,130,246,0.6)" }}>
            {guild ? `${guild.members.length} members · ${guild.total_xp.toLocaleString()} XP combined` : "Loading…"}
          </p>
        </div>
        {myRank >= 0 && (
          <span className="text-xs font-bold px-2 py-1 rounded-lg"
            style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" }}>
            #{myRank + 1}
          </span>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "#3b82f6", borderTopColor: "transparent" }} />
          </div>
        ) : !guild ? (
          <div className="text-center py-20">
            <span className="text-6xl">🏰</span>
            <p className="mt-4 font-bold" style={{ color: "#93c5fd" }}>No Guild Yet</p>
            <p className="text-sm mt-2" style={{ color: "rgba(147,197,253,0.5)" }}>
              Join a school or club to be part of a guild.
            </p>
            <a href="/join-coach"
              className="mt-4 inline-block px-5 py-2 rounded-xl text-sm font-bold"
              style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd" }}>
              Join a Coach →
            </a>
          </div>
        ) : (
          <>
            {/* Guild XP bar */}
            <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 16 }}
              className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <p className="font-bold text-white">{guild.name}</p>
                  <p className="text-xs" style={{ color: "rgba(59,130,246,0.7)" }}>
                    {guild.type === "school" ? "School Guild" : "Club Guild"} · {guild.members.length} warriors
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div style={{ background: "rgba(59,130,246,0.1)", borderRadius: 12 }} className="p-3 text-center">
                  <p className="text-xl font-black" style={{ color: "#60a5fa" }}>{guild.total_xp.toLocaleString()}</p>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(96,165,250,0.6)" }}>Guild XP</p>
                </div>
                <div style={{ background: "rgba(59,130,246,0.1)", borderRadius: 12 }} className="p-3 text-center">
                  <p className="text-xl font-black" style={{ color: "#60a5fa" }}>{guild.members.length}</p>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(96,165,250,0.6)" }}>Members</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl p-1" style={{ background: "rgba(255,255,255,0.05)" }}>
              {(["leaderboard","info"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize"
                  style={{
                    background: tab === t ? "rgba(59,130,246,0.2)" : "transparent",
                    color: tab === t ? "#60a5fa" : "rgba(255,255,255,0.3)",
                    border: tab === t ? "1px solid rgba(59,130,246,0.35)" : "1px solid transparent",
                  }}>
                  {t === "leaderboard" ? "🏆 Leaderboard" : "ℹ️ Info"}
                </button>
              ))}
            </div>

            {/* Leaderboard */}
            {tab === "leaderboard" && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 16, overflow: "hidden" }}>
                {guild.members.map((m, i) => {
                  const isMe = m.player_id === myId
                  return (
                    <div key={m.player_id}
                      style={{
                        padding: "14px 16px",
                        borderBottom: i < guild.members.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        background: isMe ? "rgba(59,130,246,0.08)" : "transparent",
                      }}
                      className="flex items-center gap-3">
                      <div style={{ width: 32, textAlign: "center", flexShrink: 0 }}>
                        {i < 3 ? (
                          <span className="text-lg">{RANK_MEDALS[i]}</span>
                        ) : (
                          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>#{i+1}</span>
                        )}
                      </div>
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: isMe ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.08)",
                        border: isMe ? "2px solid rgba(59,130,246,0.6)" : "2px solid rgba(255,255,255,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, flexShrink: 0,
                      }}>
                        {i === 0 ? "👑" : i === 1 ? "⚔️" : i === 2 ? "🛡️" : "♟"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ fontSize: 13, color: isMe ? "#93c5fd" : "#e2e8f0" }}>
                          {m.full_name}{isMe ? " (You)" : ""}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                          Lv. {m.current_level} · 🔥{m.streak_current}d
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold tabular-nums" style={{ fontSize: 13, color: "#60a5fa" }}>
                          {m.total_xp.toLocaleString()} XP
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(245,158,11,0.6)" }}>{m.gold_balance}🪙</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Info tab */}
            {tab === "info" && (
              <div className="space-y-3">
                <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 16, padding: "16px" }}>
                  <p className="font-bold mb-3" style={{ color: "#93c5fd", fontSize: 13 }}>⚔️ How Guild XP Works</p>
                  <div className="space-y-2">
                    {[
                      "Complete quest nodes to earn XP for your guild",
                      "Every 🔥 streak day multiplies your contribution",
                      "Boss defeats give bonus guild XP",
                      "Top 3 members get weekly gold chest rewards",
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span style={{ color: "#3b82f6", flexShrink: 0, fontSize: 12 }}>▸</span>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 16, padding: "16px" }}>
                  <p className="font-bold mb-2" style={{ color: "#fbbf24", fontSize: 13 }}>🏆 Weekly Chest</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                    The top 3 guild members each week share a gold chest. Keep grinding to claim your share!
                  </p>
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
