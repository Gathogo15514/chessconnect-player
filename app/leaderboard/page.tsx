"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

const MAIN_API = process.env.NEXT_PUBLIC_MAIN_API_URL ?? "https://chesslead.org"

type LeaderboardEntry = {
  rank: number
  playerId: string
  fullName: string
  points: number
  assignmentsCompleted: number
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" }

export default function LeaderboardPage() {
  const router = useRouter()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login?redirect=/leaderboard"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      setMyId(player?.id ?? null)

      try {
        const res = await fetch(`${MAIN_API}/api/v1/leaderboard`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
        })
        if (res.status === 401) { router.replace("/login"); return }
        if (!res.ok) { setApiError(`Error ${res.status}`); return }
        const data = await res.json()
        setLeaderboard(data.leaderboard ?? [])
      } catch {
        setApiError("Could not reach the server.")
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  const monthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">{monthLabel}</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Leaderboard</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : apiError ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-destructive">Could not load the leaderboard</p>
          <p className="mt-1 text-[13px] text-destructive/70">{apiError}</p>
        </Card>
      ) : leaderboard.length === 0 ? (
        <EmptyState icon={Trophy} title="No points yet this month" detail="Complete exercises your coach assigns to start climbing the leaderboard." />
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {leaderboard.map(e => (
            <div
              key={e.playerId}
              className={"flex items-center gap-3 p-3.5 " + (e.playerId === myId ? "bg-primary/5" : "")}
            >
              <span className="flex w-8 shrink-0 items-center justify-center text-[15px] font-bold text-muted-foreground">
                {MEDAL[e.rank] ?? `#${e.rank}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {e.fullName}{e.playerId === myId ? " (you)" : ""}
                </p>
                <p className="text-[11.5px] text-muted-foreground">{e.assignmentsCompleted} exercise{e.assignmentsCompleted === 1 ? "" : "s"} completed</p>
              </div>
              <span className="shrink-0 text-[14px] font-bold tabular-nums text-brand-green">{e.points} pts</span>
            </div>
          ))}
        </Card>
      )}
    </AppShell>
  )
}
