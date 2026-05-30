"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { fmtDate, fmtWeekday } from "@/lib/dates"

type AttendanceRecord = {
  status:    string
  method?:   string | null
  marked_at: string
  sessions?: {
    id:           string
    title:        string
    session_date: string
    start_time?:  string | null
    end_time?:    string | null
    topic?:       string | null
    coaches?:     { profiles?: { full_name?: string | null } | null } | null
  } | null
}

const STATUS: Record<string, { color: string; glow: string; label: string; icon: string }> = {
  present: { color: "#10B981", glow: "rgba(16,185,129,0.15)",  label: "Present", icon: "✓" },
  late:    { color: "#F59E0B", glow: "rgba(245,158,11,0.15)",  label: "Late",    icon: "⏰" },
  excused: { color: "#60A5FA", glow: "rgba(96,165,250,0.15)",  label: "Excused", icon: "○" },
  absent:  { color: "#F87171", glow: "rgba(248,113,113,0.15)", label: "Absent",  icon: "✗" },
}

const S = {
  bg:      "#070B17",
  surface: "#0D1224",
  border:  "rgba(255,255,255,0.06)",
  text:    "#F1F5F9",
  text2:   "#64748B",
  text3:   "#334155",
  green:   "#10B981",
}

export default function SessionsPage() {
  const router = useRouter()
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase.from("attendance") as any)
        .select("status, method, marked_at, sessions(id, title, session_date, start_time, end_time, topic, coaches(profiles(full_name)))")
        .eq("player_id", player.id)
        .order("marked_at", { ascending: false })

      if (err) { setError(err.message) } else { setAttendance(data ?? []) }
      setLoading(false)
    })
  }, [router])

  const total   = attendance.length
  const present = attendance.filter(a => a.status === "present").length
  const late    = attendance.filter(a => a.status === "late").length
  const pct     = total > 0 ? Math.round(((present + late) / total) * 100) : null

  return (
    <div style={{ minHeight: "100vh", background: S.bg, paddingBottom: 80 }}>
      <style>{`
        @keyframes cc-spin    { to { transform: rotate(360deg); } }
        @keyframes cc-fade-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "18px 16px 14px",
        background: `linear-gradient(180deg, ${S.surface} 0%, transparent 100%)`,
        display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <span style={{ fontSize: 22, filter: `drop-shadow(0 0 8px ${S.green})` }}>📅</span>
        <span style={{
          fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 19,
          color: S.text, letterSpacing: "0.02em",
        }}>
          Sessions
        </span>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "4px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <div style={{
              width: 36, height: 36,
              border: `3px solid ${S.green}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "cc-spin 0.9s linear infinite",
            }} />
          </div>
        ) : error ? (
          <div style={{
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: 18, padding: "20px 16px", textAlign: "center",
          }}>
            <p style={{ color: "#F87171", fontWeight: 600 }}>Could not load sessions</p>
            <p style={{ color: "rgba(248,113,113,0.6)", fontSize: 13, marginTop: 6 }}>{error}</p>
          </div>
        ) : (
          <>
            {/* ── Attendance summary ──────────────────────────── */}
            {pct !== null && (
              <div style={{
                background: S.surface, border: `1px solid rgba(16,185,129,0.18)`,
                borderRadius: 22, padding: 18,
                display: "flex", alignItems: "center", gap: 20,
                animation: "cc-fade-up 0.35s ease both",
              }}>
                {/* SVG ring */}
                <div style={{ position: "relative", flexShrink: 0, width: 76, height: 76 }}>
                  <svg width="76" height="76" viewBox="0 0 76 76">
                    <circle cx="38" cy="38" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="38" cy="38" r="30" fill="none"
                      stroke={pct >= 80 ? S.green : pct >= 60 ? "#F59E0B" : "#F87171"}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${pct * 1.884} 188.4`}
                      transform="rotate(-90 38 38)"
                    />
                  </svg>
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{
                      fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 16,
                      color: S.text,
                    }}>{pct}%</span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <p style={{
                    fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 22,
                    color: S.text, lineHeight: 1,
                  }}>
                    {present + late}
                    <span style={{ fontSize: 14, color: S.text3, fontWeight: 500 }}> / {total}</span>
                  </p>
                  <p style={{ color: S.text2, fontSize: 12, marginTop: 4 }}>Sessions attended</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {(["present","late","excused","absent"] as const).map(s => {
                      const count = attendance.filter(a => a.status === s).length
                      if (!count) return null
                      const st = STATUS[s]
                      return (
                        <span key={s} style={{
                          fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                          color: st.color, background: st.glow,
                          border: `1px solid ${st.color}30`,
                          borderRadius: 20, padding: "2px 8px",
                        }}>
                          {st.icon} {count} {st.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Session list ────────────────────────────────── */}
            {attendance.length === 0 ? (
              <div style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 20, padding: 48, textAlign: "center",
              }}>
                <span style={{ fontSize: 40 }}>📅</span>
                <p style={{ color: S.text2, fontWeight: 600, marginTop: 12, fontFamily: "var(--cc-font-display)" }}>
                  No sessions yet
                </p>
                <p style={{ color: S.text3, fontSize: 13, marginTop: 6 }}>
                  Your attendance will appear here once your coach marks sessions.
                </p>
              </div>
            ) : (
              <div style={{
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 20, overflow: "hidden",
                animation: "cc-fade-up 0.4s ease 0.05s both",
              }}>
                {attendance.map((a, i) => {
                  const st = STATUS[a.status] ?? STATUS.absent
                  return (
                    <div key={i} style={{
                      padding: "13px 16px",
                      borderBottom: i < attendance.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      {/* Status orb */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: st.glow,
                        border: `1px solid ${st.color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "var(--cc-font-display)", fontWeight: 800,
                        fontSize: 16, color: st.color,
                      }}>
                        {st.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          color: S.text, fontWeight: 600, fontSize: 13,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {a.sessions?.title ?? "Session"}
                        </p>
                        <p style={{ color: S.text3, fontSize: 11, marginTop: 2 }}>
                          {a.sessions?.session_date
                            ? `${fmtWeekday(a.sessions.session_date)}, ${fmtDate(a.sessions.session_date)}`
                            : "—"}
                          {a.sessions?.start_time ? ` · ${a.sessions.start_time.slice(0, 5)}` : ""}
                          {a.sessions?.coaches?.profiles?.full_name
                            ? ` · ${a.sessions.coaches.profiles.full_name}`
                            : ""}
                        </p>
                        {a.sessions?.topic && (
                          <p style={{ color: "#334155", fontSize: 11, marginTop: 1, fontStyle: "italic" }}>
                            {a.sessions.topic}
                          </p>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{
                          fontFamily: "var(--cc-font-display)", fontSize: 10, fontWeight: 700,
                          color: st.color, background: st.glow,
                          border: `1px solid ${st.color}30`,
                          borderRadius: 20, padding: "3px 9px",
                        }}>
                          {st.label}
                        </span>
                        {a.method && (
                          <span style={{ fontSize: 10, color: S.text3, textTransform: "capitalize" }}>
                            {a.method}
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
