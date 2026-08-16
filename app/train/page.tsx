"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"

const MAIN_API = process.env.NEXT_PUBLIC_MAIN_API_URL ?? ""

type Assignment = {
  result_id: string; assignment_id: string; player_status: string
  title: string; description?: string | null; difficulty?: string | null
  due_date?: string | null; estimated_minutes?: number | null
  total_exercises: number; topic?: { title: string; icon: string } | null
}

const DIFFICULTY_STYLE: Record<string, string> = {
  beginner: "bg-primary/10 text-primary",
  intermediate: "bg-amber-500/10 text-amber-700",
  advanced: "bg-[#5B57C7]/10 text-[#5B57C7]",
}

export default function TrainPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  // Captured post-mount rather than during render — Date.now() can't be
  // called in the render body under this project's strict purity rules.
  // The brief 0-value window before this effect fires never reaches the UI
  // since assignments (the only place `now` is read) render behind `loading`.
  const [now, setNow] = useState(0)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      try {
        const res = await fetch(`${MAIN_API}/api/v1/player/assignments/active`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
        })
        if (res.status === 401) { router.replace("/login"); return }
        if (!res.ok) { const b = await res.json().catch(() => ({})); setApiError(b.error ?? `Error ${res.status}`); return }
        const data = await res.json()
        setAssignments(data.assignments ?? [])
      } catch {
        setApiError("Could not reach the server.")
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">Assigned by your coach</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Train</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : apiError ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-destructive">Could not load training tasks</p>
          <p className="mt-1 text-[13px] text-destructive/70">{apiError}</p>
          <button onClick={() => window.location.reload()} className="mt-3 rounded-lg border border-destructive/20 px-4 py-1.5 text-[13px] text-destructive">Retry</button>
        </Card>
      ) : assignments.length === 0 ? (
        <EmptyState icon={BookOpen} title="No training assigned yet" detail="Your coach will assign lessons, exercises, and courses here." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {assignments.map(a => {
            const inProgress = a.player_status === "in_progress"
            const due = a.due_date ? new Date(a.due_date) : null
            const daysLeft = due ? Math.ceil((due.getTime() - now) / 86400000) : null
            const overdue = daysLeft !== null && daysLeft < 0
            return (
              <Link key={a.result_id} href={`/assignments/${a.assignment_id}`} className="no-underline">
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {a.topic && (
                        <span className="truncate rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {a.topic.icon} {a.topic.title}
                        </span>
                      )}
                      {overdue && <span className="text-[10px] font-bold text-destructive">OVERDUE</span>}
                    </div>
                    <Badge variant={inProgress ? "secondary" : "outline"} className="shrink-0">
                      {inProgress ? "In progress" : "Start →"}
                    </Badge>
                  </div>
                  <p className="truncate text-[14.5px] font-bold text-foreground">{a.title}</p>
                  {a.description && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{a.description}</p>}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {a.difficulty && (
                      <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold " + (DIFFICULTY_STYLE[a.difficulty] ?? "bg-secondary text-muted-foreground")}>
                        {a.difficulty}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{a.total_exercises} exercises</span>
                    {a.estimated_minutes && <span className="text-[11px] text-muted-foreground">~{a.estimated_minutes}m</span>}
                    {daysLeft !== null && !overdue && (
                      <span className={"text-[11px] " + (daysLeft <= 2 ? "font-semibold text-brand-gold" : "text-muted-foreground")}>
                        Due {daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft}d`}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
