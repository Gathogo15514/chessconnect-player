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
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 72 }}>
      <style>{`@keyframes cc-spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <header style={{ background: "#1B5E35", padding: "16px 18px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 22 }}>{guild?.emoji ?? "🏰"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#fff", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {guild?.name?.toUpperCase() ?? "GUILD"}
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
            {guild ? `${guild.members.length} members · ${guild.total_xp.toLocaleString()} XP` : "Loading…"}
          </p>
        </div>
        {myRank >= 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "rgba(255,255,255,0.15)", color: "#fff" }}>
            #{myRank + 1}
          </span>
        )}
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div style={{ width: 32, height: 32, border: "3px solid #1B5E35", borderTopColor: "transparent", borderRadius: "50%", animation: "cc-spin 0.8s linear infinite" }} />
          </div>
        ) : !guild ? (
          <div className="cc-card" style={{ padding: 40, textAlign: "center" }}>
            <span style={{ fontSize: 40 }}>🏰</span>
            <p style={{ fontWeight: 700, fontSize: 16, color: "var(--text-2)", marginTop: 12 }}>No Guild Yet</p>
            <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>Join a school or club to be part of a guild.</p>
            <a href="/join-coach" className="cc-btn-primary" style={{ marginTop: 16, display: "inline-flex", width: "auto", padding: "10px 20px", borderRadius: 10, textDecoration: "none" }}>
              Join a Coach →
            </a>
          </div>
        ) : (
          <>
            {/* Guild stats */}
            <div className="cc-card" style={{ padding: "16px 18px" }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 12 }}>{guild.name}</p>
              <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>{guild.type === "school" ? "School Guild" : "Club Guild"} · {guild.members.length} warriors</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Guild XP", value: guild.total_xp.toLocaleString() },
                  { label: "Members",  value: String(guild.members.length) },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--green-bg)", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--green)", lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, fontWeight: 500 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", background: "#fff", borderRadius: 12, padding: 4, border: "1px solid var(--border)", gap: 2 }}>
              {(["leaderboard","info"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: tab===t?700:500, background: tab===t?"#1B5E35":"transparent", color: tab===t?"#fff":"var(--text-2)", cursor: "pointer", transition: "all 0.15s" }}>
                  {t === "leaderboard" ? "🏆 Leaderboard" : "ℹ️ Info"}
                </button>
              ))}
            </div>

            {/* Leaderboard */}
            {tab === "leaderboard" && (
              <div className="cc-card" style={{ overflow: "hidden" }}>
                {guild.members.map((m, i) => {
                  const isMe = m.player_id === myId
                  return (
                    <div key={m.player_id} style={{
                      padding: "12px 16px",
                      borderBottom: i < guild.members.length - 1 ? "1px solid var(--border)" : "none",
                      background: isMe ? "var(--green-bg)" : "transparent",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
                        {i < 3
                          ? <span style={{ fontSize: 16 }}>{RANK_MEDALS[i]}</span>
                          : <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)" }}>#{i+1}</span>
                        }
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: isMe ? "var(--green-bg)" : "var(--surface-2)", border: isMe ? "2px solid var(--green)" : "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        {i === 0 ? "👑" : i === 1 ? "⚔️" : i === 2 ? "🛡️" : "♟"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: isMe ? "var(--green)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.full_name}{isMe ? " (You)" : ""}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-3)" }}>Lv. {m.current_level} · 🔥{m.streak_current}d</p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>{m.total_xp.toLocaleString()} XP</p>
                        <p style={{ fontSize: 11, color: "var(--text-3)" }}>{m.gold_balance} 🪙</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Info tab */}
            {tab === "info" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="cc-card" style={{ padding: 16 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 10 }}>⚔️ How Guild XP Works</p>
                  {["Complete quest nodes to earn XP for your guild","Every 🔥 streak day multiplies your contribution","Boss defeats give bonus guild XP","Top 3 members get weekly gold chest rewards"].map((tip, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                      <span style={{ color: "var(--green)", flexShrink: 0, fontSize: 12, marginTop: 2 }}>▸</span>
                      <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{tip}</p>
                    </div>
                  ))}
                </div>
                <div className="cc-card" style={{ padding: 16 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 8 }}>🏆 Weekly Chest</p>
                  <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>The top 3 guild members each week share a gold chest. Keep grinding to claim your share!</p>
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
