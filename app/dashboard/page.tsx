"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Grid2x2, BookOpen, Swords } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { FocusBand } from "@/components/dashboard/FocusBand"
import { MiniBoard } from "@/components/ui/mini-board"
import { Card } from "@/components/ui/card"
import { fmtTime, fmtWeekday } from "@/lib/dates"

const MAIN_API = process.env.NEXT_PUBLIC_MAIN_API_URL ?? "https://chesslead.org"

type Player = {
  id: string; fide_id?: string | null
  current_rating?: number | null; school_id?: string | null; club_id?: string | null
  schools?: { name: string } | null; clubs?: { name: string } | null
}
type Session = {
  id: string; title: string; session_date: string
  start_time: string; status: string; venue?: string | null
  coaches?: { profiles?: { full_name?: string | null } | null } | null
}
type RatingEntry = { rating: number; recorded_at: string }

export default function DashboardPage() {
  const router = useRouter()
  const [name, setName] = useState<string | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [ratingHistory, setRatingHistory] = useState<RatingEntry[]>([])
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

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
          .select("id, fide_id, current_rating, school_id, club_id, schools(name), clubs(name)")
          .eq("profile_id", uid).maybeSingle(),
      ])
      setName(pR.data?.full_name ?? null)
      const pl = plR.data ?? null
      setPlayer(pl)
      if (!pl) { setLoading(false); return }

      const today = new Date().toISOString().slice(0, 10)
      const in4w = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10)
      const f = [pl.school_id && `school_id.eq.${pl.school_id}`, pl.club_id && `club_id.eq.${pl.club_id}`]
        .filter(Boolean).join(",") || "id.eq.00000000-0000-0000-0000-000000000000"

      const [sR, rR] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sessions") as any)
          .select("id, title, session_date, start_time, status, venue, coaches(profiles(full_name))")
          .or(f).gte("session_date", today).lte("session_date", in4w)
          .order("session_date").order("start_time").limit(3),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_ratings_history") as any)
          .select("rating, recorded_at")
          .eq("player_id", pl.id).order("recorded_at", { ascending: false }).limit(10),
      ])

      setSessions(sR.data ?? [])
      setRatingHistory(rR.data ?? [])
      setLoading(false)

      // Non-blocking — the dashboard renders fine without a rank yet.
      fetch(`${MAIN_API}/api/v1/leaderboard`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => setLeaderboardRank(d?.me?.rank ?? null))
        .catch(() => {})
    })
  }, [router])

  const firstName = name?.split(" ")[0] ?? "Player"
  const org = player?.schools?.name ?? player?.clubs?.name ?? "ChessLead Trainer"
  const ratingDelta = ratingHistory.length >= 2 ? ratingHistory[0].rating - ratingHistory[1].rating : null
  const peakRating = ratingHistory.length ? Math.max(...ratingHistory.map(r => r.rating)) : null
  const nextSession = sessions[0] ?? null
  const coachName = nextSession?.coaches?.profiles?.full_name ?? null

  const focusHeadline = nextSession
    ? `Next up: ${nextSession.title}`
    : "Choose a training path to get started"
  const focusDetail = nextSession
    ? `${fmtWeekday(nextSession.session_date)} · ${fmtTime(nextSession.start_time)}${nextSession.venue ? ` · ${nextSession.venue}` : ""}`
    : "Openings · Tactics · Endgames"
  const focusHref = nextSession ? "/lessons" : "/train"

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center pt-24">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell coachName={coachName} nextSession={nextSession ? `${fmtWeekday(nextSession.session_date)} ${fmtTime(nextSession.start_time)}` : null}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Good evening,</p>
          <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">{firstName}</h1>
        </div>
        <p className="hidden text-sm text-muted-foreground md:block">{org}</p>
      </div>

      <FocusBand
        rating={player?.current_rating ?? null}
        ratingDelta={ratingDelta}
        peakRating={peakRating}
        ratingClass={player?.fide_id ? "FIDE rated" : null}
        focusHeadline={focusHeadline}
        focusDetail={focusDetail}
        focusHref={focusHref}
        leaderboardRank={leaderboardRank}
      />

      <div className="grid gap-3.5 md:grid-cols-3">
        {/* Continue training — no real training-module data yet, honest empty state */}
        <Card className="p-4 md:row-span-2">
          <div className="mb-3.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
              <BookOpen size={14} className="text-primary" /> Continue training
            </span>
            <Link href="/train" className="text-[11.5px] font-semibold text-primary no-underline">Library ›</Link>
          </div>
          <MiniBoard className="mb-4 opacity-90" />
          <p className="mb-1 text-[13px] font-semibold text-foreground">No active training path yet</p>
          <p className="mb-4 text-[12px] text-muted-foreground">Browse the library to start an openings, tactics, or endgame course.</p>
          <Link
            href="/train"
            className="mt-auto block rounded-lg bg-brand-green py-2.5 text-center text-[13px] font-bold text-white no-underline"
          >
            Browse library →
          </Link>
        </Card>

        {/* Daily puzzle — no puzzle backend yet */}
        <Card className="flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
              <Grid2x2 size={14} className="text-primary" /> Daily puzzle
            </span>
            <Link href="/puzzles" className="text-[11.5px] font-semibold text-primary no-underline">History ›</Link>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
            <Grid2x2 size={26} className="text-muted-foreground/50" />
            <p className="text-[12px] text-muted-foreground">Puzzle training is coming soon.</p>
          </div>
        </Card>

        {/* Upcoming lesson — real data */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-bold text-foreground">Upcoming lesson</span>
            <Link href="/lessons" className="text-[11.5px] font-semibold text-primary no-underline">All ›</Link>
          </div>
          {nextSession ? (
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green-mid font-serif text-[13px] font-bold text-white">
                {(coachName ?? "C").split(" ").map(n => n[0]).slice(0, 2).join("")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-bold text-foreground">{coachName ?? "Coach"}</p>
                <p className="truncate text-[12px] text-muted-foreground">{nextSession.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fmtWeekday(nextSession.session_date)} · {fmtTime(nextSession.start_time)}
                </p>
              </div>
            </div>
          ) : (
            <p className="py-2 text-[12px] text-muted-foreground">No upcoming sessions scheduled.</p>
          )}
        </Card>

        {/* Rating trend — real data if we have 2+ points */}
        <Card className="p-4 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-bold text-foreground">Rating trend</span>
            <Link href="/progress" className="text-[11.5px] font-semibold text-primary no-underline">Full stats ›</Link>
          </div>
          {ratingHistory.length > 1 ? (
            <div className="flex h-14 items-end gap-1">
              {[...ratingHistory].reverse().map((e, i, arr) => {
                const max = Math.max(...arr.map(x => x.rating))
                const min = Math.min(...arr.map(x => x.rating))
                const range = max - min || 1
                const h = Math.max(6, Math.round(((e.rating - min) / range) * 36) + 6)
                const isLatest = i === arr.length - 1
                return (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <div className={"w-full rounded-t-[3px] " + (isLatest ? "bg-brand-green" : "bg-secondary")} style={{ height: h }} />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-2 text-[12px] text-muted-foreground">Not enough rating history yet — check back after your next few games.</p>
          )}
        </Card>

        {/* Recent games — no games backend yet */}
        <Card className="p-4 md:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
              <Swords size={14} className="text-primary" /> Recent games
            </span>
            <Link href="/games" className="text-[11.5px] font-semibold text-primary no-underline">Full history ›</Link>
          </div>
          <div className="flex flex-col items-center gap-1.5 py-5 text-center">
            <p className="text-[12px] text-muted-foreground">Game history connects here once your games are recorded.</p>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
