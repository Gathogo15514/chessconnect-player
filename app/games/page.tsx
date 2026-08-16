"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Swords, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

type LichessRating = { rating: number; games: number; prog?: number }
type LichessStats = {
  username: string; title?: string | null; online: boolean
  ratings: Record<string, LichessRating>
  totalGames: number; wins: number; losses: number; draws: number
}

const FORMAT_LABEL: Record<string, string> = {
  rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", classical: "Classical",
  ultraBullet: "UltraBullet", correspondence: "Correspondence",
}

export default function GamesPage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [lichessUser, setLichessUser] = useState("")
  const [inputUser, setInputUser] = useState("")
  const [stats, setStats] = useState<LichessStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: p } = await (supabase.from("players") as any)
        .select("id, lichess_username").eq("profile_id", session.user.id).maybeSingle()
      if (p) {
        setPlayerId(p.id)
        setLichessUser(p.lichess_username ?? "")
        setInputUser(p.lichess_username ?? "")
        if (p.lichess_username) fetchLichess(p.lichess_username)
      }
      setLoading(false)
    })
  }, [router])

  async function fetchLichess(uname: string) {
    setFetching(true)
    setFetchErr(null)
    try {
      const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(uname)}`, { headers: { Accept: "application/json" } })
      if (!res.ok) { setFetchErr("Lichess user not found."); return }
      const d = await res.json()
      const ratings: Record<string, LichessRating> = {}
      for (const [k, v] of Object.entries(d.perfs ?? {})) {
        const pv = v as { rating?: number; games?: number; prog?: number }
        if (pv.games && pv.games > 0) ratings[k] = { rating: pv.rating ?? 0, games: pv.games, prog: pv.prog }
      }
      const wins = d.count?.win ?? 0, losses = d.count?.loss ?? 0, draws = d.count?.draw ?? 0
      setStats({ username: d.username ?? uname, title: d.title ?? null, online: d.online ?? false, ratings, totalGames: wins + losses + draws, wins, losses, draws })
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
    await (supabase.from("players") as any).update({ lichess_username: inputUser.trim() }).eq("id", playerId)
    setLichessUser(inputUser.trim())
    await fetchLichess(inputUser.trim())
    setSaving(false)
  }

  const winRate = stats && stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : null

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">Match history</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Games</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                <ExternalLink size={14} className="text-primary" /> Lichess account
              </span>
              {stats && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={"h-1.5 w-1.5 rounded-full " + (stats.online ? "bg-primary" : "bg-muted-foreground/40")} />
                  {stats.online ? "Online" : "Offline"}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={inputUser}
                onChange={e => setInputUser(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSave() }}
                placeholder="Your Lichess username"
              />
              <Button onClick={handleSave} disabled={saving || !inputUser.trim()}>{saving ? "…" : "Save"}</Button>
            </div>
            {fetchErr && <p className="mt-2 text-[12px] text-destructive">{fetchErr}</p>}
          </Card>

          {fetching ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
            </div>
          ) : stats ? (
            <>
              <Card className="p-0 overflow-hidden">
                <div className="grid grid-cols-4 divide-x divide-border">
                  {[
                    { label: "Games", value: stats.totalGames.toLocaleString(), className: "text-foreground" },
                    { label: "Wins", value: stats.wins.toLocaleString(), className: "text-primary" },
                    { label: "Losses", value: stats.losses.toLocaleString(), className: "text-destructive" },
                    { label: "Win %", value: winRate !== null ? `${winRate}%` : "—", className: "text-info" },
                  ].map(s => (
                    <div key={s.label} className="p-3.5 text-center">
                      <p className={"text-[16px] font-bold tabular-nums " + s.className}>{s.value}</p>
                      <p className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {Object.keys(stats.ratings).length > 0 && (
                <Card className="divide-y divide-border overflow-hidden p-0">
                  <div className="p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ratings by format</p>
                  </div>
                  {Object.entries(stats.ratings).sort((a, b) => b[1].games - a[1].games).map(([key, r]) => (
                    <div key={key} className="flex items-center justify-between p-3.5">
                      <div>
                        <p className="text-[13px] font-semibold text-foreground">{FORMAT_LABEL[key] ?? key}</p>
                        <p className="text-[11.5px] text-muted-foreground">{r.games.toLocaleString()} games</p>
                      </div>
                      <div className="text-right">
                        <p className="font-serif text-[18px] font-bold tabular-nums text-brand-green">{r.rating}</p>
                        {r.prog !== undefined && r.prog !== 0 && (
                          <p className={"text-[11px] font-bold " + (r.prog > 0 ? "text-primary" : "text-destructive")}>
                            {r.prog > 0 ? "+" : ""}{r.prog}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </>
          ) : lichessUser ? null : (
            <EmptyState icon={Swords} title="No Lichess account linked" detail="Enter your Lichess username above to see your online games, ratings, and win rate." />
          )}
        </div>
      )}
    </AppShell>
  )
}
