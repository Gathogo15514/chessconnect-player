"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { fmtTime, fmtWeekday } from "@/lib/dates"

type Session = {
  id: string; title: string; session_date: string; start_time: string
  coaches?: { profiles?: { full_name?: string | null } | null } | null
}

export default function CoachPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id, school_id, club_id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) { setLoading(false); return }
      const today = new Date().toISOString().slice(0, 10)
      const f = [player.school_id && `school_id.eq.${player.school_id}`, player.club_id && `club_id.eq.${player.club_id}`]
        .filter(Boolean).join(",") || "id.eq.00000000-0000-0000-0000-000000000000"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("sessions") as any)
        .select("id, title, session_date, start_time, coaches(profiles(full_name))")
        .or(f).gte("session_date", today)
        .order("session_date").order("start_time").limit(10)
      setSessions(data ?? [])
      setLoading(false)
    })
  }, [router])

  const coachName = sessions.find(s => s.coaches?.profiles?.full_name)?.coaches?.profiles?.full_name ?? null

  return (
    <AppShell coachName={coachName}>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">Your training team</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Coach</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : !coachName ? (
        <EmptyState icon={UserRound} title="No coach assigned yet" detail="Once your club or school assigns a coach, their profile and your training plan will appear here." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="flex items-center gap-4 p-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-green-mid font-serif text-xl font-bold text-white">
              {coachName.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </span>
            <div>
              <p className="font-serif text-lg font-bold text-foreground">{coachName}</p>
              <p className="text-[13px] text-muted-foreground">{sessions.length} upcoming session{sessions.length === 1 ? "" : "s"} scheduled</p>
            </div>
          </Card>

          {sessions.length > 0 && (
            <Card className="divide-y divide-border overflow-hidden p-0">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3.5">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="text-[10px] font-bold uppercase leading-none">{fmtWeekday(s.session_date)}</span>
                    <span className="text-[15px] font-bold leading-none tabular-nums">{new Date(s.session_date + "T00:00:00").getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{s.title}</p>
                    <p className="text-[12px] text-muted-foreground">{fmtTime(s.start_time)}</p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </AppShell>
  )
}
