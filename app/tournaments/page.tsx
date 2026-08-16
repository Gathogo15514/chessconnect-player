"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { fmtDate } from "@/lib/dates"

type Tournament = { id: string; title: string; status: string; start_date: string; venue_name?: string | null; entry_fee_kes?: number | null; is_fide_rated?: boolean | null; format?: string | null; participant_count?: number | null; max_participants?: number | null; counties?: { name: string } | null; tournament_types?: { label: string } | null }
type Registration = { id: string; status: string; payment_status: string; seeding_number?: number | null; created_at: string; tournaments: Tournament | null }

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  pending: "bg-amber-500/10 text-amber-700",
  waitlisted: "bg-info/10 text-info",
  withdrawn: "bg-muted text-muted-foreground",
  disqualified: "bg-destructive/10 text-destructive",
}

export default function TournamentsPage() {
  const router = useRouter()
  const [regs, setRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"upcoming" | "past" | "withdrawn">("upcoming")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any).select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) { setLoading(false); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("tournament_registrations") as any)
        .select("id,status,payment_status,seeding_number,created_at,tournaments(id,title,status,start_date,venue_name,entry_fee_kes,is_fide_rated,format,participant_count,max_participants,counties(name),tournament_types(label))")
        .eq("player_id", player.id).order("created_at", { ascending: false })
      setRegs(data ?? [])
      setLoading(false)
    })
  }, [router])

  const today = new Date()
  const upcoming = regs.filter(r => r.tournaments && !["withdrawn", "disqualified"].includes(r.status) && (new Date(r.tournaments.start_date) >= today || r.tournaments.status === "in_progress"))
  const past = regs.filter(r => r.tournaments && !["withdrawn", "disqualified"].includes(r.status) && new Date(r.tournaments.start_date) < today && r.tournaments.status !== "in_progress")
  const withdrawn = regs.filter(r => ["withdrawn", "disqualified"].includes(r.status))
  const lists = { upcoming, past, withdrawn }
  const visible = lists[tab]

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">{regs.length} registration{regs.length !== 1 ? "s" : ""}</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Tournaments</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["upcoming", "past", "withdrawn"] as const).map(t => (
              <button
                key={t} onClick={() => setTab(t)}
                className={"flex-1 rounded-lg px-2 py-2 text-[12px] font-semibold capitalize transition-colors " + (tab === t ? "bg-brand-green text-white" : "text-muted-foreground")}
              >
                {t} <span className="opacity-70">({lists[t].length})</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={Trophy} title={`No ${tab} tournaments`} detail="Tournament registrations made by your coach or club will appear here." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {visible.map(r => {
                const t = r.tournaments
                if (!t) return null
                const days = Math.ceil((new Date(t.start_date).getTime() - today.getTime()) / 86400000)
                const isLive = t.status === "in_progress"
                return (
                  <Card key={r.id} className="p-0 overflow-hidden">
                    <div className="border-b border-border p-3.5">
                      {isLive && (
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                          <span className="text-[11px] font-bold tracking-wide text-primary">LIVE NOW</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <p className="text-[14.5px] font-bold text-foreground">{t.title}</p>
                          {t.tournament_types?.label && <p className="mt-0.5 text-[12px] text-muted-foreground">{t.tournament_types.label}</p>}
                        </div>
                        <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize " + (STATUS_STYLE[r.status] ?? STATUS_STYLE.pending)}>{r.status}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-3.5 text-[12px] text-muted-foreground">
                      <span>{fmtDate(t.start_date)}</span>
                      {t.venue_name && <span className="truncate">{t.venue_name}</span>}
                      {t.counties?.name && <span>{t.counties.name}</span>}
                      {t.format && <span>{t.format}</span>}
                      {t.entry_fee_kes != null && <span>KES {t.entry_fee_kes.toLocaleString()}</span>}
                      {t.is_fide_rated && <span className="font-semibold text-info">FIDE Rated</span>}
                    </div>
                    <div className="flex items-center justify-between border-t border-border p-3.5">
                      <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold " + (r.payment_status === "paid" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700")}>
                        {r.payment_status === "paid" ? "Paid" : r.payment_status}
                      </span>
                      <div className="flex items-center gap-2">
                        {days > 0 && days <= 14 && <span className="text-[12px] font-medium text-brand-gold">{days === 1 ? "Tomorrow" : `In ${days} days`}</span>}
                        {t.participant_count != null && <span className="text-[11px] text-muted-foreground">{t.participant_count}{t.max_participants ? `/${t.max_participants}` : ""} players</span>}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
