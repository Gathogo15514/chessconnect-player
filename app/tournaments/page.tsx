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
  counties?:          { name: string } | null
  tournament_types?:  { label: string } | null
}

type Registration = {
  id:              string
  status:          string
  payment_status:  string
  seeding_number?: number | null
  rating_at_reg?:  number | null
  created_at:      string
  tournaments:     Tournament | null
}

const REG_STATUS: Record<string, { color: string; glow: string }> = {
  confirmed:    { color: "#10B981", glow: "rgba(16,185,129,0.12)"  },
  pending:      { color: "#F59E0B", glow: "rgba(245,158,11,0.12)"  },
  waitlisted:   { color: "#60A5FA", glow: "rgba(96,165,250,0.12)"  },
  withdrawn:    { color: "#64748B", glow: "rgba(100,116,139,0.10)" },
  disqualified: { color: "#F87171", glow: "rgba(248,113,113,0.10)" },
}

const S = {
  bg:      "#070B17",
  surface: "#0D1224",
  card:    "#121829",
  border:  "rgba(255,255,255,0.06)",
  text:    "#F1F5F9",
  text2:   "#64748B",
  text3:   "#334155",
  gold:    "#F0B429",
  amber:   "#F59E0B",
  green:   "#10B981",
  purple:  "#818CF8",
}

const TABS: { key: "upcoming" | "past" | "withdrawn"; label: string; icon: string }[] = [
  { key: "upcoming",  label: "Upcoming",  icon: "🏆" },
  { key: "past",      label: "Past",      icon: "📜" },
  { key: "withdrawn", label: "Withdrawn", icon: "↩" },
]

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

  const today    = new Date()
  const upcoming = regs.filter(r => {
    if (!r.tournaments || ["withdrawn","disqualified"].includes(r.status)) return false
    return new Date(r.tournaments.start_date) >= today || r.tournaments.status === "in_progress"
  })
  const past = regs.filter(r => {
    if (!r.tournaments || ["withdrawn","disqualified"].includes(r.status)) return false
    return new Date(r.tournaments.start_date) < today && r.tournaments.status !== "in_progress"
  })
  const withdrawn = regs.filter(r => ["withdrawn","disqualified"].includes(r.status))
  const lists     = { upcoming, past, withdrawn }
  const visible   = lists[tab] ?? []

  return (
    <div style={{ minHeight: "100vh", background: S.bg, paddingBottom: 80 }}>
      <style>{`
        @keyframes cc-spin    { to { transform: rotate(360deg); } }
        @keyframes cc-fade-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes cc-live    { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "18px 16px 14px",
        background: `linear-gradient(180deg, ${S.surface} 0%, transparent 100%)`,
        display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <span style={{ fontSize: 22, filter: `drop-shadow(0 0 8px ${S.gold})` }}>🏆</span>
        <span style={{
          fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 19,
          color: S.text, letterSpacing: "0.02em",
        }}>
          Tournaments
        </span>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "4px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <div style={{
              width: 36, height: 36,
              border: `3px solid ${S.gold}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "cc-spin 0.9s linear infinite",
            }} />
          </div>
        ) : (
          <>
            {/* ── Tabs ────────────────────────────────────────── */}
            <div style={{
              display: "flex", gap: 6,
              background: S.surface, borderRadius: 16, padding: 5,
              border: `1px solid ${S.border}`,
              animation: "cc-fade-up 0.35s ease both",
            }}>
              {TABS.map(t => {
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      flex: 1, padding: "9px 4px",
                      background: active ? S.card : "transparent",
                      border: active ? `1px solid rgba(240,180,41,0.2)` : "1px solid transparent",
                      borderRadius: 11,
                      fontFamily: "var(--cc-font-display)", fontSize: 11, fontWeight: 700,
                      color: active ? S.gold : S.text2,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {t.icon} {t.label}
                    <span style={{
                      marginLeft: 4, fontSize: 10,
                      color: active ? S.gold : S.text3,
                    }}>
                      ({lists[t.key].length})
                    </span>
                  </button>
                )
              })}
            </div>

            {/* ── List ────────────────────────────────────────── */}
            {visible.length === 0 ? (
              <div style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 20, padding: 48, textAlign: "center",
              }}>
                <span style={{ fontSize: 44 }}>🏆</span>
                <p style={{ color: S.text2, fontWeight: 600, marginTop: 14, fontFamily: "var(--cc-font-display)" }}>
                  {tab === "upcoming" ? "No upcoming tournaments" : tab === "past" ? "No past tournaments" : "No withdrawn registrations"}
                </p>
                <p style={{ color: S.text3, fontSize: 13, marginTop: 6 }}>
                  Your registrations will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "cc-fade-up 0.38s ease 0.05s both" }}>
                {visible.map(r => {
                  const t = r.tournaments
                  if (!t) return null
                  const daysUntil = Math.ceil((new Date(t.start_date).getTime() - today.getTime()) / 86400000)
                  const isLive    = t.status === "in_progress"
                  const rs        = REG_STATUS[r.status] ?? REG_STATUS.pending
                  return (
                    <div key={r.id} style={{
                      background: S.surface,
                      border: `1px solid ${isLive ? "rgba(245,158,11,0.3)" : S.border}`,
                      borderRadius: 20, overflow: "hidden",
                      boxShadow: isLive ? "0 0 20px rgba(245,158,11,0.08)" : "none",
                    }}>
                      {/* Card header */}
                      <div style={{
                        padding: "14px 16px 10px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isLive && (
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                              <span style={{
                                width: 7, height: 7, borderRadius: "50%",
                                background: S.amber, display: "inline-block",
                                animation: "cc-live 1.2s ease-in-out infinite",
                              }} />
                              <span style={{
                                fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                                color: S.amber, letterSpacing: "0.1em",
                              }}>
                                LIVE NOW
                              </span>
                            </div>
                          )}
                          <p style={{
                            fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 15,
                            color: S.text, lineHeight: 1.3,
                          }}>
                            {t.title}
                          </p>
                          {t.tournament_types?.label && (
                            <p style={{ color: S.text3, fontSize: 11, marginTop: 3 }}>
                              {t.tournament_types.label}
                            </p>
                          )}
                        </div>
                        <span style={{
                          fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                          color: rs.color, background: rs.glow,
                          border: `1px solid ${rs.color}30`,
                          borderRadius: 20, padding: "4px 10px", flexShrink: 0,
                          textTransform: "capitalize",
                        }}>
                          {r.status}
                        </span>
                      </div>

                      {/* Details grid */}
                      <div style={{
                        padding: "10px 16px 12px",
                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 16px",
                      }}>
                        <span style={{ fontSize: 12, color: S.text2 }}>📅 {fmtDate(t.start_date)}</span>
                        {t.venue_name && <span style={{ fontSize: 12, color: S.text2 }}>📍 {t.venue_name}</span>}
                        {t.counties?.name && <span style={{ fontSize: 12, color: S.text2 }}>🗺 {t.counties.name}</span>}
                        {t.format && <span style={{ fontSize: 12, color: S.text2 }}>⏱ {t.format}</span>}
                        {t.entry_fee_kes != null && (
                          <span style={{ fontSize: 12, color: S.text2 }}>💰 KES {t.entry_fee_kes.toLocaleString()}</span>
                        )}
                        {t.is_fide_rated && (
                          <span style={{
                            fontSize: 12, color: "#818CF8",
                            fontFamily: "var(--cc-font-display)", fontWeight: 700,
                          }}>
                            ★ FIDE Rated
                          </span>
                        )}
                        {r.rating_at_reg && <span style={{ fontSize: 12, color: S.text2 }}>Rating: {r.rating_at_reg}</span>}
                        {r.seeding_number && <span style={{ fontSize: 12, color: S.text2 }}>Seed #{r.seeding_number}</span>}
                      </div>

                      {/* Footer */}
                      <div style={{
                        padding: "8px 16px 12px",
                        borderTop: "1px solid rgba(255,255,255,0.03)",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <span style={{
                          fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                          color: r.payment_status === "paid" ? S.green : S.amber,
                          background: r.payment_status === "paid" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                          border: `1px solid ${r.payment_status === "paid" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
                          borderRadius: 20, padding: "3px 9px",
                        }}>
                          {r.payment_status === "paid" ? "✓ Paid" : r.payment_status}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {daysUntil > 0 && daysUntil <= 14 && (
                            <span style={{ fontSize: 12, color: S.amber, fontWeight: 600 }}>
                              {daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                            </span>
                          )}
                          {t.participant_count != null && (
                            <span style={{ fontSize: 11, color: S.text3 }}>
                              {t.participant_count}{t.max_participants ? `/${t.max_participants}` : ""} players
                            </span>
                          )}
                        </div>
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
