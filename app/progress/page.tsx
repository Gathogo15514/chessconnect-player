"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, Target, Grid2x2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

type RatingEntry = { rating: number; recorded_at: string }
type AttendanceRecord = { status: string }

export default function ProgressPage() {
  const router = useRouter()
  const [ratingHistory, setRatingHistory] = useState<RatingEntry[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) { setLoading(false); return }
      const [rR, aR] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_ratings_history") as any)
          .select("rating, recorded_at").eq("player_id", player.id)
          .order("recorded_at", { ascending: true }).limit(30),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("attendance") as any)
          .select("status").eq("player_id", player.id),
      ])
      setRatingHistory(rR.data ?? [])
      setAttendance(aR.data ?? [])
      setLoading(false)
    })
  }, [router])

  const latest = ratingHistory.at(-1)?.rating ?? null
  const first = ratingHistory[0]?.rating ?? null
  const netChange = latest !== null && first !== null ? latest - first : null
  const peak = ratingHistory.length ? Math.max(...ratingHistory.map(r => r.rating)) : null

  const totalSessions = attendance.length
  const attended = attendance.filter(a => a.status === "present" || a.status === "late").length
  const attendancePct = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : null

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">How you&apos;re developing</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Progress</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Rating development */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                <TrendingUp size={14} className="text-primary" /> Rating development
              </span>
              {latest !== null && (
                <span className="font-serif text-2xl font-bold tabular-nums text-foreground">{latest}</span>
              )}
            </div>
            {ratingHistory.length > 1 ? (
              <>
                <div className="flex h-24 items-end gap-1.5">
                  {ratingHistory.map((e, i, arr) => {
                    const max = Math.max(...arr.map(x => x.rating))
                    const min = Math.min(...arr.map(x => x.rating))
                    const range = max - min || 1
                    const h = Math.max(10, Math.round(((e.rating - min) / range) * 72) + 10)
                    const isLatest = i === arr.length - 1
                    return (
                      <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                        <div className={"w-full rounded-t-[3px] " + (isLatest ? "bg-brand-green" : "bg-secondary")} style={{ height: h }} />
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex gap-6 border-t border-border pt-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Peak</p>
                    <p className="text-[15px] font-bold tabular-nums text-foreground">{peak}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Net change</p>
                    <p className={"text-[15px] font-bold tabular-nums " + (netChange !== null && netChange >= 0 ? "text-primary" : "text-destructive")}>
                      {netChange !== null ? (netChange >= 0 ? `+${netChange}` : netChange) : "—"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-4 text-[13px] text-muted-foreground">Not enough rating history yet — check back after your next few games.</p>
            )}
          </Card>

          {/* Training consistency — real, from attendance */}
          <Card className="p-5">
            <span className="mb-4 flex items-center gap-1.5 text-[13px] font-bold text-foreground">
              <Target size={14} className="text-primary" /> Training consistency
            </span>
            {attendancePct !== null ? (
              <div className="flex items-center gap-5">
                <div className="relative h-16 w-16 shrink-0">
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="7" />
                    <circle
                      cx="32" cy="32" r="26" fill="none"
                      stroke="var(--primary)" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${attendancePct * 1.634} 163.4`}
                      transform="rotate(-90 32 32)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-foreground">{attendancePct}%</div>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{attended} of {totalSessions} sessions attended</p>
                  <p className="text-[12px] text-muted-foreground">Based on all recorded sessions</p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No sessions recorded yet.</p>
            )}
          </Card>

          {/* Puzzle performance — no backend yet */}
          <EmptyState icon={Grid2x2} title="Puzzle performance coming soon" detail="Once puzzle training is live, your rating, accuracy, and tactical strengths/weaknesses will show up here." />
        </div>
      )}
    </AppShell>
  )
}
