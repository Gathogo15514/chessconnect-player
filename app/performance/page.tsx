"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

type LichessRating = { rating: number; games: number; prog?: number }

type LichessStats = {
  username:   string
  title?:     string | null
  online:     boolean
  ratings:    Record<string, LichessRating>
  totalGames: number
  wins:       number
  losses:     number
  draws:      number
}

type RatingEntry = { rating: number; recorded_at: string; rating_type?: string }

const FORMAT_LABEL: Record<string, string> = {
  rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", classical: "Classical",
  ultraBullet: "UltraBullet", correspondence: "Correspondence",
}

export default function PerformancePage() {
  const router = useRouter()
  const [playerId,      setPlayerId]      = useState<string | null>(null)
  const [lichessUser,   setLichessUser]   = useState("")
  const [inputUser,     setInputUser]     = useState("")
  const [stats,         setStats]         = useState<LichessStats | null>(null)
  const [ratingHistory, setRatingHistory] = useState<RatingEntry[]>([])
  const [loading,       setLoading]       = useState(true)
  const [fetching,      setFetching]      = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [fetchErr,      setFetchErr]      = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      const [playerRes, ratingRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("players") as any)
          .select("id, lichess_username").eq("profile_id", session.user.id).maybeSingle(),
        // placeholder — we'll fetch after we have player id
        Promise.resolve({ data: [] }),
      ])

      const p = playerRes.data
      if (p) {
        setPlayerId(p.id)
        setLichessUser(p.lichess_username ?? "")
        setInputUser(p.lichess_username ?? "")
        if (p.lichess_username) fetchLichess(p.lichess_username)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: hist } = await (supabase.from("player_ratings_history") as any)
          .select("rating, recorded_at, rating_type")
          .eq("player_id", p.id)
          .order("recorded_at", { ascending: true })
          .limit(12)
        setRatingHistory(hist ?? [])
      }
      void ratingRes
      setLoading(false)
    })
  }, [router])

  async function fetchLichess(uname: string) {
    setFetching(true)
    setFetchErr(null)
    try {
      const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(uname)}`, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) { setFetchErr("Lichess user not found."); return }
      const d = await res.json()
      const ratings: Record<string, LichessRating> = {}
      let wins = 0, losses = 0, draws = 0
      for (const [k, v] of Object.entries(d.perfs ?? {})) {
        const pv = v as { rating?: number; games?: number; prog?: number }
        if (pv.games && pv.games > 0) {
          ratings[k] = { rating: pv.rating ?? 0, games: pv.games, prog: pv.prog }
        }
      }
      if (d.count) {
        wins   = d.count.win   ?? 0
        losses = d.count.loss  ?? 0
        draws  = d.count.draw  ?? 0
      }
      setStats({
        username:   d.username ?? uname,
        title:      d.title ?? null,
        online:     d.online ?? false,
        ratings,
        totalGames: wins + losses + draws,
        wins, losses, draws,
      })
    } catch {
      setFetchErr("Could not reach Lichess. Check your connection.")
    } finally {
      setFetching(false)
    }
  }

  async function handleSave() {
    if (!playerId || !inputUser.trim()) return
    setSaving(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("players") as any)
      .update({ lichess_username: inputUser.trim() }).eq("id", playerId)
    setLichessUser(inputUser.trim())
    await fetchLichess(inputUser.trim())
    setSaving(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const winRate = stats && stats.totalGames > 0
    ? Math.round((stats.wins / stats.totalGames) * 100) : null

  return (
    <div style={{ minHeight: "100vh", background: "#070B17", paddingBottom: 80 }}>
      <header style={{ padding: "18px 16px 14px", background: "linear-gradient(180deg, #0D1224 0%, transparent 100%)", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 40 }}>
        <span style={{ fontSize: 22, filter: "drop-shadow(0 0 8px #10B981)" }}>📈</span>
        <span style={{ fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 19, color: "#F1F5F9", letterSpacing: "0.02em" }}>Performance</span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-24">
            <div style={{ width: 36, height: 36, border: "3px solid #10B981", borderTopColor: "transparent", borderRadius: "50%", animation: "cc-spin 0.9s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* Rating history (ChessConnect) */}
            {ratingHistory.length > 0 && (
              <div style={{ background: "#0D1224", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <h2 style={{ fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 13, color: "#F1F5F9" }}>Rating History (ChessConnect)</h2>
                </div>
                <div className="px-4 py-4">
                  <div className="flex items-end gap-1.5 h-20">
                    {ratingHistory.map((e, i, arr) => {
                      const maxR = Math.max(...arr.map(x => x.rating))
                      const minR = Math.min(...arr.map(x => x.rating))
                      const range = maxR - minR || 1
                      const h = Math.max(16, Math.round(((e.rating - minR) / range) * 60) + 16)
                      const isLatest = i === arr.length - 1
                      const prev = arr[i - 1]
                      const delta = prev ? e.rating - prev.rating : null
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

            {/* Lichess username input */}
            <div style={{ background: "#0D1224", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 16 }}>
              <h2 className="font-bold text-stone-800 mb-3">Lichess Profile</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputUser}
                  onChange={e => setInputUser(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSave() }}
                  placeholder="Your Lichess username"
                  className="cc-input"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !inputUser.trim()}
                  style={{ padding: "8px 16px", background: "#0D8A5C", color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", opacity: (saving || !inputUser?.trim()) ? 0.4 : 1 }}
                >
                  {saving ? "…" : "Save"}
                </button>
              </div>
              {fetchErr && <p className="text-xs text-red-600 mt-2">{fetchErr}</p>}
            </div>

            {/* Lichess stats */}
            {fetching ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : stats ? (
              <>
                {/* Win/loss/draw */}
                <div style={{ background: "#0D1224", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
                  <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                    <div>
                      <h2 style={{ fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 13, color: "#F1F5F9" }}>{stats.username}</h2>
                      {stats.title && <span className="text-xs font-bold text-amber-600">{stats.title}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${stats.online ? "bg-emerald-500" : "bg-stone-300"}`} />
                      <span style={{ fontSize: 11, color: "#475569" }}>{stats.online ? "Online" : "Offline"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-stone-100">
                    {[
                      { label: "Games",  value: stats.totalGames.toLocaleString(), color: "text-stone-800" },
                      { label: "Wins",   value: stats.wins.toLocaleString(),       color: "text-emerald-600" },
                      { label: "Losses", value: stats.losses.toLocaleString(),     color: "text-red-500"     },
                      { label: "Win %",  value: winRate !== null ? `${winRate}%` : "—", color: "text-blue-600" },
                    ].map((s, i) => (
                      <div key={i} className="px-3 py-3 text-center">
                        <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-stone-400 font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ratings by format */}
                {Object.keys(stats.ratings).length > 0 && (
                  <div style={{ background: "#0D1224", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <h2 style={{ fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 13, color: "#F1F5F9" }}>Ratings by Format</h2>
                    </div>
                    {Object.entries(stats.ratings)
                      .sort((a, b) => b[1].games - a[1].games)
                      .map(([key, r], i, arr) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>{FORMAT_LABEL[key] ?? key}</p>
                            <p style={{ fontSize: 11, color: "#475569" }}>{r.games.toLocaleString()} games</p>
                          </div>
                          <div className="text-right">
                            <p style={{ fontSize: 18, fontWeight: 800, color: "#F1F5F9", fontFamily: "var(--cc-font-display)" }}>{r.rating}</p>
                            {r.prog !== undefined && r.prog !== 0 && (
                              <p className={`text-xs font-bold ${r.prog > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                {r.prog > 0 ? "+" : ""}{r.prog}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : lichessUser ? null : (
              <div style={{ background: "#0D1224", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 32, textAlign: "center" }}>
                <span style={{ fontSize: 40 }}>⚡</span>
                <p style={{ fontFamily: "var(--cc-font-display)", color: "#64748B", fontWeight: 600, marginTop: 12 }}>No Lichess account linked</p>
                <p style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>Enter your Lichess username above to see your online stats.</p>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
