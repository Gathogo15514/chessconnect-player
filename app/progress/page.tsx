"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

const LEVEL_TITLES: Record<number, { title: string; symbol: string }> = {
  1:  { title: "PAWN",            symbol: "♟" },
  4:  { title: "KNIGHT",          symbol: "♞" },
  7:  { title: "BISHOP",          symbol: "♝" },
  10: { title: "ROOK",            symbol: "♜" },
  15: { title: "QUEEN INITIATE",  symbol: "♛" },
  20: { title: "QUEEN",           symbol: "♛" },
  25: { title: "KING'S GUARD",    symbol: "♚" },
  30: { title: "GRAND TACTICIAN", symbol: "🏅" },
  40: { title: "CHESS CHAMPION",  symbol: "🏆" },
  50: { title: "GRANDMASTER",     symbol: "♔" },
}
function getLevelTitle(level: number) {
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a)
  const match = keys.find(k => level >= k)
  return match != null ? LEVEL_TITLES[match] : { title: "PAWN", symbol: "♟" }
}
function xpPercent(totalXp: number, levelStart: number, levelThreshold: number) {
  const range = levelThreshold - levelStart
  const prog  = totalXp - levelStart
  if (range <= 0) return 100
  return Math.min(100, Math.round((prog / range) * 100))
}

type GameProfile = {
  current_level: number; total_xp: number; gold_balance: number
  streak_current: number; streak_shields: number
  level_xp_start: number; level_xp_threshold: number
}
type QuestAssignment = {
  id: string; status: string; expires_at: string | null
  quest_campaigns?: { id: string; title: string; cover_emoji?: string | null; description?: string | null } | null
}
type XPEvent = { event_type: string; xp_awarded: number; created_at: string; notes?: string | null }

const XP_LABEL: Record<string, string> = {
  quest_complete: "Quest Complete", quest_perfect: "Perfect Clear",
  boss_defeated: "Boss Defeated", session_attended: "Session Attended",
  streak_bonus: "Streak Bonus", tournament_played: "Tournament Played",
  tournament_win: "Tournament Win", coach_award: "Coach Award",
  rating_milestone: "Rating Milestone",
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
          .select("id, status, expires_at, quest_campaigns(id, title, cover_emoji, description)")
          .eq("player_id", player.id).eq("status", "active").limit(6),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_xp_events") as any)
          .select("event_type, xp_awarded, created_at, notes")
          .eq("player_id", player.id).order("created_at", { ascending: false }).limit(12),
      ])
      setGp(gpRes.data ?? null); setQuests(questRes.data ?? []); setXpLog(xpRes.data ?? [])
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
  const lt          = getLevelTitle(level)

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 72 }}>
      <style>{`
        @keyframes cc-spin    { to { transform: rotate(360deg); } }
        @keyframes cc-shimmer { 0% { background-position:-300% center; } 100% { background-position:300% center; } }
        @keyframes cc-float   { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
      `}</style>

      <header style={{ padding:"16px 18px 12px", background:"rgba(9,9,11,0.95)", borderBottom:"1px solid rgba(232,197,71,0.1)", display:"flex", alignItems:"center", gap:10, position:"sticky", top:0, zIndex:40, backdropFilter:"blur(20px)" }}>
        <span style={{ fontFamily:"serif", fontSize:20, color:"var(--purple)" }}>♛</span>
        <span style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text)", letterSpacing:"0.08em" }}>XP &amp; LEVEL</span>
      </header>

      <main style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 0", display:"flex", flexDirection:"column", gap:14 }}>
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", paddingTop:80 }}>
            <div style={{ width:36, height:36, border:"3px solid var(--purple)", borderTopColor:"transparent", borderRadius:"50%", animation:"cc-spin 0.9s linear infinite" }} />
          </div>
        ) : !gp ? (
          <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:20, padding:48, textAlign:"center" }}>
            <span style={{ fontFamily:"serif", fontSize:52, color:"rgba(167,139,250,0.3)" }}>♛</span>
            <p style={{ fontFamily:"var(--font-display)", color:"var(--text-3)", fontSize:16, letterSpacing:"0.08em", marginTop:12 }}>NO PROGRESS YET</p>
            <p style={{ fontSize:12, color:"var(--text-4)", marginTop:6 }}>Complete missions and attend sessions to earn XP.</p>
          </div>
        ) : (
          <>
            {/* Level hero */}
            <div style={{ background:"var(--card)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:24, padding:20, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", right:-10, top:-10, fontFamily:"serif", fontSize:110, color:"rgba(167,139,250,0.05)", lineHeight:1, pointerEvents:"none", animation:"cc-float 4s ease-in-out infinite" }}>
                {lt.symbol}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18 }}>
                <div style={{ width:72, height:72, borderRadius:18, flexShrink:0, background:"rgba(167,139,250,0.1)", border:"2px solid rgba(167,139,250,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"serif", fontSize:34, color:"var(--purple)" }}>
                  {lt.symbol}
                </div>
                <div>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:11, color:"var(--purple)", letterSpacing:"0.14em", marginBottom:3 }}>{lt.title}</p>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:38, color:"var(--text)", lineHeight:1 }}>LEVEL {level}</p>
                  <p style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>{totalXp.toLocaleString()} XP earned</p>
                </div>
              </div>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:9, color:"var(--text-3)", letterSpacing:"0.12em" }}>PROGRESS TO LV {level+1}</span>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:9, color:"var(--purple)", letterSpacing:"0.08em" }}>{xpPct}%</span>
                </div>
                <div style={{ height:8, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
                  <div style={{ width:`${Math.max(2,xpPct)}%`, height:"100%", borderRadius:99, background:"linear-gradient(90deg,#7C3AED,#A78BFA,#C4B5FD,#A78BFA)", backgroundSize:"300% auto", animation:"cc-shimmer 3s linear infinite", boxShadow:"0 0 12px rgba(167,139,250,0.5)" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:8, color:"var(--text-4)" }}>{levelStart.toLocaleString()}</span>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:8, color:"var(--text-4)" }}>{levelThresh.toLocaleString()} XP</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {[
                { label:"GOLD",    value:gold.toLocaleString(), icon:"🪙", color:"var(--gold)" },
                { label:"STREAK",  value:`${streak}D`,          icon:"🔥", color:"var(--orange)" },
                { label:"SHIELDS", value:String(shields),       icon:"🛡", color:"var(--blue)" },
              ].map(s => (
                <div key={s.label} style={{ background:"var(--card)", border:`1px solid rgba(255,255,255,0.06)`, borderRadius:18, padding:"16px 10px", textAlign:"center" }}>
                  <span style={{ fontSize:22 }}>{s.icon}</span>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:22, color:s.color, marginTop:6, lineHeight:1 }}>{s.value}</p>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:8, color:"var(--text-4)", letterSpacing:"0.12em", marginTop:5 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Active quests */}
            {quests.length > 0 && (
              <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:20, overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:13, color:"var(--text)", letterSpacing:"0.08em" }}>ACTIVE QUESTS</span>
                </div>
                {quests.map((q,i) => {
                  const c = q.quest_campaigns
                  return (
                    <div key={q.id} style={{ padding:"12px 18px", borderBottom:i<quests.length-1?"1px solid rgba(255,255,255,0.03)":"none", display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:24, flexShrink:0 }}>{c?.cover_emoji ?? "⚔"}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c?.title ?? "Quest"}</p>
                        {q.expires_at && <p style={{ fontFamily:"var(--font-display)", fontSize:9, color:"var(--amber)", letterSpacing:"0.08em", marginTop:3 }}>EXPIRES {new Date(q.expires_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</p>}
                      </div>
                      <span style={{ fontFamily:"var(--font-display)", fontSize:9, color:"var(--green)", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:99, padding:"3px 9px", letterSpacing:"0.08em" }}>ACTIVE</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* XP History */}
            {xpLog.length > 0 && (
              <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:20, overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:13, color:"var(--text)", letterSpacing:"0.08em" }}>XP HISTORY</span>
                </div>
                {xpLog.map((e,i) => (
                  <div key={i} style={{ padding:"10px 18px", borderBottom:i<xpLog.length-1?"1px solid rgba(255,255,255,0.025)":"none", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:500, color:"var(--text-2)" }}>{XP_LABEL[e.event_type] ?? e.event_type}</p>
                      {e.notes && <p style={{ fontSize:10, color:"var(--text-3)", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.notes}</p>}
                      <p style={{ fontFamily:"var(--font-display)", fontSize:9, color:"var(--text-4)", letterSpacing:"0.08em", marginTop:2 }}>{new Date(e.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</p>
                    </div>
                    <span style={{ fontFamily:"var(--font-display)", fontSize:16, color:"var(--gold)", flexShrink:0 }}>+{e.xp_awarded}</span>
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
