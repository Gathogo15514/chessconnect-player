"use client"

import { useEffect, useState } from "react"
import Link                    from "next/link"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

const MAIN_API = process.env.NEXT_PUBLIC_MAIN_API_URL ?? ""

type Assignment = {
  result_id:          string
  assignment_id:      string
  player_status:      string
  title:              string
  description?:       string | null
  difficulty?:        string | null
  due_date?:          string | null
  estimated_minutes?: number | null
  total_exercises:    number
  topic?:             { title: string; icon: string } | null
}

const DIFF: Record<string, { color: string; glow: string; label: string }> = {
  beginner:     { color: "#10B981", glow: "rgba(16,185,129,0.18)",   label: "Beginner"     },
  intermediate: { color: "#F59E0B", glow: "rgba(245,158,11,0.18)",   label: "Intermediate" },
  advanced:     { color: "#818CF8", glow: "rgba(129,140,248,0.18)",  label: "Advanced"     },
}

const S = {
  bg:      "#070B17",
  surface: "#0D1224",
  card:    "#121829",
  border:  "rgba(255,255,255,0.06)",
  text:    "#F1F5F9",
  text2:   "#64748B",
  text3:   "#334155",
  green:   "#10B981",
  gold:    "#F0B429",
  amber:   "#F59E0B",
  purple:  "#818CF8",
  blue:    "#60A5FA",
}

export default function MissionsPage() {
  const router = useRouter()
  const [missions,  setMissions]  = useState<Assignment[]>([])
  const [loading,   setLoading]   = useState(true)
  const [apiError,  setApiError]  = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      try {
        const res = await fetch(`${MAIN_API}/api/v1/player/assignments/active`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache:   "no-store",
        })

        if (res.status === 401) { router.replace("/login"); return }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setApiError(body.error ?? `Error ${res.status} from server`)
          return
        }

        const data = await res.json()
        setMissions(data.assignments ?? [])
      } catch {
        setApiError("Could not reach the server. Check your connection.")
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        @keyframes cc-spin    { to { transform: rotate(360deg); } }
        @keyframes cc-fade-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes cc-pulse   { 0%,100% { opacity:0.7; } 50% { opacity:1; } }
        .mission-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .mission-card:active { transform: scale(0.98); }
      `}</style>

      {/* Header */}
      <header style={{ padding:"16px 18px 12px", background:"rgba(9,9,11,0.95)", borderBottom:"1px solid rgba(232,197,71,0.1)", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40, backdropFilter:"blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily:"serif", fontSize:20, color:"var(--orange)" }}>⚔</span>
          <span style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text)", letterSpacing:"0.08em" }}>MISSIONS</span>
        </div>
        {!loading && !apiError && missions.length > 0 && (
          <span style={{
            fontFamily: "var(--cc-font-display)", fontSize: 11, fontWeight: 700,
            color: S.amber, background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 20, padding: "3px 10px",
          }}>
            {missions.length} Active
          </span>
        )}
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "4px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <div style={{
              width: 36, height: 36,
              border: `3px solid ${S.amber}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "cc-spin 0.9s linear infinite",
            }} />
          </div>
        ) : apiError ? (
          <div style={{
            background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: 18, padding: "24px 20px", textAlign: "center",
            animation: "cc-fade-up 0.35s ease both",
          }}>
            <span style={{ fontSize: 36 }}>⚠️</span>
            <p style={{ color: "#F87171", fontWeight: 600, marginTop: 10, fontFamily: "var(--cc-font-display)" }}>
              Could not load missions
            </p>
            <p style={{ color: "rgba(248,113,113,0.6)", fontSize: 13, marginTop: 6 }}>{apiError}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16, padding: "8px 20px",
                background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 10, color: "#F87171",
                fontFamily: "var(--cc-font-display)", fontSize: 12, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        ) : missions.length === 0 ? (
          <div style={{
            background: "var(--card)", border: `1px solid ${S.border}`,
            borderRadius: 22, padding: "48px 24px", textAlign: "center",
            animation: "cc-fade-up 0.35s ease both",
          }}>
            <span style={{ fontSize: 52 }}>🎯</span>
            <p style={{
              color: S.text2, fontWeight: 700, marginTop: 14, fontSize: 16,
              fontFamily: "var(--cc-font-display)",
            }}>
              No missions yet
            </p>
            <p style={{ color: S.text3, fontSize: 13, marginTop: 6 }}>
              Your coach will assign missions here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "cc-fade-up 0.35s ease both" }}>
            {missions.map((m, idx) => {
              const diff   = DIFF[m.difficulty ?? ""] ?? null
              const isNew  = m.player_status === "pending" || m.player_status === "assigned"
              const inProg = m.player_status === "in_progress"
              const today  = new Date()
              const due    = m.due_date ? new Date(m.due_date) : null
              const daysLeft = due ? Math.ceil((due.getTime() - today.getTime()) / 86400000) : null
              const isOverdue = daysLeft !== null && daysLeft < 0

              return (
                <Link key={m.result_id} href={`/assignments/${m.assignment_id}`} style={{ textDecoration: "none" }}>
                  <div className="mission-card" style={{
                    background: "var(--card)",
                    border: `1px solid ${inProg ? "rgba(96,165,250,0.25)" : S.border}`,
                    borderLeft: `3px solid ${diff?.color ?? (inProg ? S.blue : "rgba(255,255,255,0.08)")}`,
                    borderRadius: 20,
                    padding: 16,
                    boxShadow: inProg ? "0 0 20px rgba(96,165,250,0.06)" : "none",
                    animationDelay: `${idx * 0.04}s`,
                  }}>
                    {/* Row 1: topic + badges */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {m.topic && (
                          <span style={{
                            fontSize: 10, color: S.text3,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 8, padding: "2px 7px",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {m.topic.icon} {m.topic.title}
                          </span>
                        )}
                        {isOverdue && (
                          <span style={{
                            fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                            color: "#F87171", animation: "cc-pulse 1.5s ease-in-out infinite",
                          }}>
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                        color: inProg ? S.blue : S.text3,
                        background: inProg ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${inProg ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 20, padding: "3px 9px", flexShrink: 0,
                      }}>
                        {inProg ? "In Progress" : "Start"}
                      </span>
                    </div>

                    {/* Row 2: title + description */}
                    <p style={{
                      fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 15,
                      color: S.text, lineHeight: 1.3, marginBottom: m.description ? 5 : 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {m.title}
                    </p>
                    {m.description && (
                      <p style={{
                        color: S.text3, fontSize: 12, lineHeight: 1.5, marginBottom: 8,
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      }}>
                        {m.description}
                      </p>
                    )}

                    {/* Row 3: meta tags */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {diff && (
                        <span style={{
                          fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                          color: diff.color, background: diff.glow,
                          border: `1px solid ${diff.color}30`,
                          borderRadius: 20, padding: "2px 8px",
                        }}>
                          {diff.label}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: S.text3 }}>
                        {m.total_exercises} exercises
                      </span>
                      {m.estimated_minutes && (
                        <span style={{ fontSize: 11, color: S.text3 }}>
                          ~{m.estimated_minutes}m
                        </span>
                      )}
                      {daysLeft !== null && !isOverdue && (
                        <span style={{
                          fontSize: 11,
                          color: daysLeft <= 2 ? S.amber : S.text3,
                          fontWeight: daysLeft <= 2 ? 600 : 400,
                        }}>
                          Due {daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft}d`}
                        </span>
                      )}
                      {isOverdue && due && (
                        <span style={{ fontSize: 11, color: "#F87171" }}>
                          Was due {due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
