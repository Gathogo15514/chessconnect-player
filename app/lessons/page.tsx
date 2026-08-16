"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CalendarDays, Video } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { fmtDate, fmtWeekday } from "@/lib/dates"

const JOINABLE_TYPES = ["classroom", "workshop", "online_analysis", "online"]

type AttendanceRecord = {
  status: string
  marked_at: string
  sessions?: {
    id: string; title: string; session_date: string
    start_time?: string | null; topic?: string | null
    session_type?: string | null; status?: string | null
    coaches?: { profiles?: { full_name?: string | null } | null } | null
  } | null
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  present: { label: "Attended", className: "bg-primary/10 text-primary" },
  late:    { label: "Late",     className: "bg-amber-500/10 text-amber-700" },
  excused: { label: "Excused",  className: "bg-info/10 text-info" },
  absent:  { label: "Absent",   className: "bg-destructive/10 text-destructive" },
}

export default function LessonsPage() {
  const router = useRouter()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) { setLoading(false); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("attendance") as any)
        .select("status, marked_at, sessions(id, title, session_date, start_time, topic, session_type, status, coaches(profiles(full_name)))")
        .eq("player_id", player.id).order("marked_at", { ascending: false }).limit(30)
      setRecords(data ?? [])
      setLoading(false)
    })
  }, [router])

  const upcoming = records.filter(r => r.sessions && r.sessions.session_date >= new Date().toISOString().slice(0, 10))
  const past = records.filter(r => r.sessions && r.sessions.session_date < new Date().toISOString().slice(0, 10))

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">Coaching sessions</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Lessons</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No lessons yet" detail="Your scheduled and past sessions will appear here once your coach adds them." />
      ) : (
        <div className="flex flex-col gap-5">
          {upcoming.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Upcoming</p>
              <Card className="divide-y divide-border overflow-hidden p-0">
                {upcoming.map((r, i) => {
                  const s = r.sessions!
                  const joinable = s.session_type && JOINABLE_TYPES.includes(s.session_type) && s.status !== "completed" && s.status !== "cancelled"
                  const isLive = s.status === "in_progress"
                  return (
                    <div key={i} className="flex items-center gap-3 p-3.5">
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="text-[10px] font-bold uppercase leading-none">{fmtWeekday(s.session_date)}</span>
                        <span className="text-[15px] font-bold leading-none tabular-nums">{new Date(s.session_date + "T00:00:00").getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">{s.title}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {s.start_time?.slice(0, 5)}{s.coaches?.profiles?.full_name ? ` · ${s.coaches.profiles.full_name}` : ""}
                        </p>
                      </div>
                      {joinable && (
                        <Link
                          href={`/classroom/${s.id}`}
                          className={
                            "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold no-underline " +
                            (isLive ? "bg-primary text-primary-foreground" : "border border-border text-foreground")
                          }
                        >
                          <Video size={13} /> {isLive ? "Join live" : "Join"}
                        </Link>
                      )}
                    </div>
                  )
                })}
              </Card>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Past</p>
              <Card className="divide-y divide-border overflow-hidden p-0">
                {past.map((r, i) => {
                  const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.absent
                  return (
                    <div key={i} className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">{r.sessions?.title ?? "Session"}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {r.sessions?.session_date ? fmtDate(r.sessions.session_date) : "—"}
                          {r.sessions?.coaches?.profiles?.full_name ? ` · ${r.sessions.coaches.profiles.full_name}` : ""}
                        </p>
                      </div>
                      <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + st.className}>{st.label}</span>
                    </div>
                  )
                })}
              </Card>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
