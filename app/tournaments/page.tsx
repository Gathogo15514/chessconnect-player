"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { fmtDate }             from "@/lib/dates"

type Tournament = {
  id:               string
  title:            string
  event_type?:      string | null
  status:           string
  start_date:       string
  end_date?:        string | null
  venue_name?:      string | null
  entry_fee_kes?:   number | null
  is_fide_rated?:   boolean | null
  format?:          string | null
  participant_count?: number | null
  max_participants?:  number | null
  counties?:         { name: string } | null
  tournament_types?: { label: string } | null
}

type Registration = {
  id:             string
  status:         string
  payment_status: string
  seeding_number?: number | null
  rating_at_reg?:  number | null
  created_at:     string
  tournaments:    Tournament | null
}

const REG_STATUS: Record<string, string> = {
  confirmed:    "bg-emerald-100 text-emerald-700",
  pending:      "bg-amber-100 text-amber-700",
  waitlisted:   "bg-blue-100 text-blue-700",
  withdrawn:    "bg-stone-100 text-stone-500",
  disqualified: "bg-red-100 text-red-600",
}

const PAY_STATUS: Record<string, string> = {
  paid:    "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
  waived:  "bg-blue-50 text-blue-600",
}

export default function TournamentsPage() {
  const router = useRouter()
  const [regs,    setRegs]    = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<"upcoming" | "past" | "withdrawn">("upcoming")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()

      if (!player) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("tournament_registrations") as any)
        .select(`
          id, status, payment_status, seeding_number, rating_at_reg, created_at,
          tournaments(id, title, event_type, status, start_date, end_date,
            venue_name, entry_fee_kes, is_fide_rated, format,
            participant_count, max_participants,
            counties(name), tournament_types(label))
        `)
        .eq("player_id", player.id)
        .order("created_at", { ascending: false })

      setRegs(data ?? [])
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const today = new Date()
  const upcoming  = regs.filter(r => {
    if (!r.tournaments) return false
    if (["withdrawn","disqualified"].includes(r.status)) return false
    return new Date(r.tournaments.start_date) >= today || r.tournaments.status === "in_progress"
  })
  const past = regs.filter(r => {
    if (!r.tournaments) return false
    if (["withdrawn","disqualified"].includes(r.status)) return false
    return new Date(r.tournaments.start_date) < today && r.tournaments.status !== "in_progress"
  })
  const withdrawn = regs.filter(r => ["withdrawn","disqualified"].includes(r.status))

  const lists: Record<string, Registration[]> = { upcoming, past, withdrawn }
  const visible = lists[tab] ?? []

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-lg">Tournaments</span>
        </div>
        <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white">Sign out</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-stone-900 mb-4">My Tournaments</h1>

            {/* Tabs */}
            <div className="flex bg-stone-100 rounded-xl p-1 mb-5">
              {(["upcoming","past","withdrawn"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                    tab === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                  }`}
                >
                  {t}
                  <span className="ml-1 text-[10px]">({lists[t].length})</span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-4xl">🏆</span>
                <p className="mt-3 text-stone-600 font-medium">
                  {tab === "upcoming" ? "No upcoming tournaments" : tab === "past" ? "No past tournaments" : "No withdrawn registrations"}
                </p>
                <p className="text-sm text-stone-400 mt-1">Your registrations will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map(r => {
                  const t = r.tournaments
                  if (!t) return null
                  const daysUntil = Math.ceil((new Date(t.start_date).getTime() - today.getTime()) / 86400000)
                  const isLive    = t.status === "in_progress"
                  return (
                    <div key={r.id} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-stone-900 text-sm leading-snug">{t.title}</p>
                          {t.tournament_types?.label && (
                            <p className="text-xs text-stone-400 mt-0.5">{t.tournament_types.label}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${REG_STATUS[r.status] ?? "bg-stone-100 text-stone-500"}`}>
                            {r.status}
                          </span>
                          {isLive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Live</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span>📅 {fmtDate(t.start_date)}</span>
                        {t.venue_name && <span>📍 {t.venue_name}</span>}
                        {t.counties?.name && <span>🗺 {t.counties.name}</span>}
                        {t.format && <span>⏱ {t.format}</span>}
                        {t.entry_fee_kes != null && <span>💰 KES {t.entry_fee_kes.toLocaleString()}</span>}
                        {t.is_fide_rated && <span className="text-blue-600 font-medium">FIDE Rated</span>}
                        {r.rating_at_reg && <span>Rating at reg: {r.rating_at_reg}</span>}
                        {r.seeding_number && <span>Seed #{r.seeding_number}</span>}
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-50">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PAY_STATUS[r.payment_status] ?? "bg-stone-100 text-stone-500"}`}>
                          {r.payment_status === "paid" ? "✓ Paid" : r.payment_status}
                        </span>
                        {daysUntil > 0 && daysUntil <= 14 && (
                          <span className="text-xs text-amber-600 font-medium">
                            {daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                          </span>
                        )}
                        {t.participant_count != null && (
                          <span className="text-xs text-stone-400">
                            {t.participant_count}{t.max_participants ? `/${t.max_participants}` : ""} players
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
