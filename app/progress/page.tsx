"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

const S = {
  bg:      "#070B17",
  surface: "#0D1224",
  card:    "#121829",
  border:  "rgba(255,255,255,0.06)",
  text:    "#F1F5F9",
  text2:   "#64748B",
  text3:   "#334155",
  green:   "#10B981",
  gold:    "#F0B429",
  purple:  "#818CF8",
  amber:   "#F59E0B",
  blue:    "#60A5FA",
}

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
    id:           string
    title:        string
    theme?:       string | null
    cover_emoji?: string | null
    description?: string | null
  } | null
}

type XPEvent = {
  event_type: string
  xp_awarded: number
  created_at: string
  notes?:     string | null
}

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

export default function ProgressPage() {
  const router = useRouter()
  const [gp,      setGp]      = useState<GameProfile | null>(null)
  const [quests,  setQuests]  = useState<QuestAssignment[]>([])
  const [xpLog,   setXpLog]   = useState<XPEvent[]>([])
  const [loading, setLoading] = useState(true)

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
          .select("id, status, expires_at, quest_campaigns(id, title, theme, cover_emoji, description)")
          .eq("player_id", player.id).eq("status", "active").limit(6),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_xp_events") as any)
          .select("event_type, xp_awarded, created_at, notes")
          .eq("player_id", player.id)
          .order("created_at", { ascending: false }).limit(12),
      ])

      setGp(gpRes.data ?? null)
      setQuests(questRes.data ?? [])
      setXpLog(xpRes.data ?? [])
      setLoading(false)
    })
  }, [router])

  const level       = gp?.current_level ?? 1
  const totalXp     = gp?.total_xp ?? 0
  const gold        = gp?.gold_balance ?? 0
  const streak      = gp?.streak_current ?? 0
  const shields     = gp?.streak_shields ?? 0
  const levelStart  = gp?.level_xp_start ?? 0
  const levelThresh = gp?.level_xp_threshold ?? 100
  const xpPct       = xpPercent(totalXp, levelStart, levelThresh)
  const levelTitle  = getLevelTitle(level)

  return (
    <div style={{ minHeight: "100vh", background: S.bg, paddingBottom: 80 }}>
      <style>{`
        @keyframes cc-spin    { to { transform: rotate(360deg); } }
        @keyframes cc-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes cc-float   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes cc-fade-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "18px 16px 14px",
        background: `linear-gradient(180deg, ${S.surface} 0%, transparent 100%)`,
        display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <span style={{ fontSize: 22, filter: `drop-shadow(0 0 8px ${S.purple})` }}>⚡</span>
        <span style={{
          fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 19,
          color: S.text, letterSpacing: "0.02em",
        }}>
          XP &amp; Level
        </span>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "4px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <div style={{
              width: 36, height: 36,
              border: `3px solid ${S.purple}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "cc-spin 0.9s linear infinite",
            }} />
          </div>
        ) : !gp ? (
          <div style={{
            background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 20, padding: 48, textAlign: "center",
            animation: "cc-fade-up 0.35s ease both",
          }}>
            <span style={{ fontSize: 44 }}>⚡</span>
            <p style={{ color: S.text2, fontWeight: 600, marginTop: 12, fontFamily: "var(--cc-font-display)" }}>
              No progress yet
            </p>
            <p style={{ color: S.text3, fontSize: 13, marginTop: 6 }}>
              Complete missions and attend sessions to earn XP.
            </p>
          </div>
        ) : (
          <>
            {/* ── Level hero card ─────────────────────────────── */}
            <div style={{
              background: `linear-gradient(135deg, ${S.surface} 0%, #12152A 100%)`,
              border: "1px solid rgba(129,140,248,0.2)",
              borderRadius: 24, padding: 20,
              position: "relative", overflow: "hidden",
              animation: "cc-fade-up 0.35s ease both",
            }}>
              {/* Watermark */}
              <div style={{
                position: "absolute", right: -4, top: -8,
                fontSize: 96, opacity: 0.04, pointerEvents: "none",
                fontFamily: "serif", lineHeight: 1, userSelect: "none",
              }}>
                {levelTitle.emoji}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                {/* Level orb */}
                <div style={{
                  width: 76, height: 76, borderRadius: "50%", flexShrink: 0,
                  background: "radial-gradient(circle at 35% 35%, rgba(129,140,248,0.28), rgba(129,140,248,0.07))",
                  border: "2px solid rgba(129,140,248,0.4)",
                  boxShadow: "0 0 24px rgba(129,140,248,0.18)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  animation: "cc-float 3.5s ease-in-out infinite",
                }}>
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{levelTitle.emoji}</span>
                </div>

                <div>
                  <p style={{
                    fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                    color: S.purple, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 3,
                  }}>
                    {levelTitle.title}
                  </p>
                  <p style={{
                    fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 30,
                    color: S.text, lineHeight: 1,
                  }}>
                    Level {level}
                  </p>
                  <p style={{ color: S.text3, fontSize: 12, marginTop: 4 }}>
                    {totalXp.toLocaleString()} XP earned
                  </p>
                </div>
              </div>

              {/* XP bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{
                    color: S.text2, fontSize: 11, fontWeight: 600,
                    fontFamily: "var(--cc-font-display)",
                  }}>
                    Progress to Level {level + 1}
                  </span>
                  <span style={{
                    color: S.purple, fontSize: 11, fontWeight: 700,
                    fontFamily: "var(--cc-font-display)",
                  }}>
                    {xpPct}%
                  </span>
                </div>
                <div style={{ height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.max(2, xpPct)}%`, height: "100%", borderRadius: 99,
                    background: "linear-gradient(90deg, #6366F1, #818CF8, #A5B4FC, #818CF8)",
                    backgroundSize: "200% auto",
                    animation: "cc-shimmer 2.5s linear infinite",
                    boxShadow: "0 0 14px rgba(129,140,248,0.45)",
                    transition: "width 0.9s cubic-bezier(0.34,1.56,0.64,1)",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                  <span style={{ color: S.text3, fontSize: 10 }}>{levelStart.toLocaleString()} XP</span>
                  <span style={{ color: S.text3, fontSize: 10 }}>{levelThresh.toLocaleString()} XP</span>
                </div>
              </div>
            </div>

            {/* ── Stats row ────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, animation: "cc-fade-up 0.4s ease 0.05s both" }}>
              {[
                { label: "Gold",    value: gold.toLocaleString(), icon: "🪙", color: S.gold,   border: "rgba(240,180,41,0.2)"  },
                { label: "Streak",  value: `${streak}d`,           icon: "🔥", color: S.amber,  border: "rgba(245,158,11,0.2)"  },
                { label: "Shields", value: String(shields),        icon: "🛡", color: S.blue,   border: "rgba(96,165,250,0.2)"  },
              ].map(s => (
                <div key={s.label} style={{
                  background: S.surface, border: `1px solid ${s.border}`,
                  borderRadius: 18, padding: "16px 10px", textAlign: "center",
                }}>
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                  <p style={{
                    fontFamily: "var(--cc-font-display)", fontWeight: 800,
                    fontSize: 20, color: s.color, marginTop: 6, lineHeight: 1,
                  }}>{s.value}</p>
                  <p style={{
                    fontFamily: "var(--cc-font-display)", fontSize: 9, color: S.text3,
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", marginTop: 5,
                  }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* ── Active quests ────────────────────────────────── */}
            {quests.length > 0 && (
              <div style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 20, overflow: "hidden",
                animation: "cc-fade-up 0.4s ease 0.1s both",
              }}>
                <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <p style={{
                    fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 13,
                    color: S.text,
                  }}>
                    ⚔️ Active Quests
                  </p>
                </div>
                {quests.map((q, i) => {
                  const c = q.quest_campaigns
                  return (
                    <div key={q.id} style={{
                      padding: "12px 16px",
                      borderBottom: i < quests.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <span style={{ fontSize: 26, flexShrink: 0 }}>{c?.cover_emoji ?? "⚔️"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          color: S.text, fontWeight: 600, fontSize: 13,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {c?.title ?? "Quest"}
                        </p>
                        {c?.description && (
                          <p style={{ color: S.text3, fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.description}
                          </p>
                        )}
                        {q.expires_at && (
                          <p style={{ color: S.amber, fontSize: 10, marginTop: 2 }}>
                            Expires {new Date(q.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                      <span style={{
                        fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                        color: S.green, background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.2)",
                        borderRadius: 20, padding: "3px 9px", flexShrink: 0,
                      }}>
                        Active
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── XP History ───────────────────────────────────── */}
            {xpLog.length > 0 && (
              <div style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 20, overflow: "hidden",
                animation: "cc-fade-up 0.4s ease 0.15s both",
              }}>
                <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <p style={{
                    fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 13, color: S.text,
                  }}>
                    📜 XP History
                  </p>
                </div>
                {xpLog.map((e, i) => (
                  <div key={i} style={{
                    padding: "11px 16px",
                    borderBottom: i < xpLog.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "#94A3B8", fontWeight: 600, fontSize: 13 }}>
                        {XP_LABEL[e.event_type] ?? e.event_type}
                      </p>
                      {e.notes && (
                        <p style={{ color: S.text3, fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {e.notes}
                        </p>
                      )}
                      <p style={{ color: S.text3, fontSize: 10, marginTop: 2 }}>
                        {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span style={{
                      fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 14,
                      color: S.gold, flexShrink: 0,
                    }}>
                      +{e.xp_awarded} XP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
