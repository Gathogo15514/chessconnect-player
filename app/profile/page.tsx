"use client"

import { useEffect, useState }       from "react"
import { useRouter }                  from "next/navigation"
import { createClient }               from "@/lib/supabase/client"
import { BottomNav }                  from "@/components/BottomNav"
import { BOARD_THEMES, PIECE_SETS }   from "@/components/chess/themes"
import type { ThemeId, PieceSetId }   from "@/components/chess/themes"
import { AVATARS, getAvatar }         from "@/lib/avatars"
import type { AvatarId }              from "@/lib/avatars"

const S = {
  bg:      "#070B17",
  surface: "#0D1224",
  card:    "#121829",
  border:  "rgba(255,255,255,0.06)",
  borderMed: "rgba(255,255,255,0.10)",
  text:    "#F1F5F9",
  text2:   "#64748B",
  text3:   "#334155",
  green:   "#10B981",
  gold:    "#F0B429",
  amber:   "#F59E0B",
  purple:  "#818CF8",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 20, overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <p style={{
          fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 12,
          color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          {title}
        </p>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="cc-label">{label}</label>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState<string | null>(null)

  const [fullName,        setFullName]        = useState("")
  const [email,           setEmail]           = useState("")
  const [playerId,        setPlayerId]        = useState<string | null>(null)
  const [fideId,          setFideId]          = useState("")
  const [admissionNumber, setAdmissionNumber] = useState("")
  const [dateOfBirth,     setDateOfBirth]     = useState("")
  const [guardianName,    setGuardianName]    = useState("")
  const [guardianPhone,   setGuardianPhone]   = useState("")
  const [school,          setSchool]          = useState<string | null>(null)
  const [club,            setClub]            = useState<string | null>(null)
  const [currentRating,   setCurrentRating]   = useState<number | null>(null)
  const [fideTitle,       setFideTitle]       = useState<string | null>(null)
  const [boardTheme,      setBoardTheme]      = useState<ThemeId>("classic")
  const [pieceSet,        setPieceSet]        = useState<PieceSetId>("standard")
  const [boardFlipped,    setBoardFlipped]    = useState(false)
  const [avatarId,        setAvatarId]        = useState<AvatarId>("pawn_hero")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }
      setEmail(session.user.email ?? "")

      const [profileRes, playerRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("profiles") as any).select("full_name").eq("id", session.user.id).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("players") as any)
          .select("id, fide_id, fide_title, current_rating, admission_number, date_of_birth, guardian_name, guardian_phone, schools(name), clubs(name)")
          .eq("profile_id", session.user.id).maybeSingle(),
      ])

      if (playerRes.data?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: gp } = await (supabase.from("player_game_profiles") as any)
          .select("board_theme, piece_set, board_flipped, avatar_id").eq("player_id", playerRes.data.id).maybeSingle()
        if (gp?.board_theme) setBoardTheme(gp.board_theme as ThemeId)
        if (gp?.piece_set)   setPieceSet(gp.piece_set as PieceSetId)
        if (typeof gp?.board_flipped === "boolean") setBoardFlipped(gp.board_flipped)
        if (gp?.avatar_id)   setAvatarId(gp.avatar_id as AvatarId)
      }

      setFullName(profileRes.data?.full_name ?? "")
      const pl = playerRes.data
      if (pl) {
        setPlayerId(pl.id)
        setFideId(pl.fide_id ?? "")
        setFideTitle(pl.fide_title ?? null)
        setCurrentRating(pl.current_rating ?? null)
        setAdmissionNumber(pl.admission_number ?? "")
        setDateOfBirth(pl.date_of_birth ?? "")
        setGuardianName(pl.guardian_name ?? "")
        setGuardianPhone(pl.guardian_phone ?? "")
        setSchool(pl.schools?.name ?? null)
        setClub(pl.clubs?.name ?? null)
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace("/login"); return }

    const errors: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileErr } = await (supabase.from("profiles") as any)
      .update({ full_name: fullName }).eq("id", session.user.id)
    if (profileErr) errors.push(profileErr.message)

    if (playerId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: playerErr } = await (supabase.from("players") as any)
        .update({
          fide_id:          fideId          || null,
          admission_number: admissionNumber || null,
          date_of_birth:    dateOfBirth     || null,
          guardian_name:    guardianName    || null,
          guardian_phone:   guardianPhone   || null,
        }).eq("id", playerId)
      if (playerErr) errors.push(playerErr.message)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gpExists } = await (supabase.from("player_game_profiles") as any)
        .select("player_id").eq("player_id", playerId).maybeSingle()
      if (gpExists) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: gpErr } = await (supabase.from("player_game_profiles") as any)
          .update({ board_theme: boardTheme, piece_set: pieceSet, board_flipped: boardFlipped, avatar_id: avatarId })
          .eq("player_id", playerId)
        if (gpErr) errors.push(gpErr.message)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: gpErr } = await (supabase.from("player_game_profiles") as any)
          .insert({ player_id: playerId, board_theme: boardTheme, piece_set: pieceSet, board_flipped: boardFlipped,
            avatar_id: avatarId, current_level: 1, total_xp: 0, gold_balance: 0, streak_current: 0,
            streak_shields: 0, level_xp_start: 0, level_xp_threshold: 100 })
        if (gpErr) errors.push(gpErr.message)
      }
    }

    setSaveMsg(errors.length ? `Error: ${errors.join("; ")}` : "Profile saved!")
    setSaving(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const av = getAvatar(avatarId)

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        @keyframes cc-spin { to { transform: rotate(360deg); } }
        @keyframes cc-float   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>

      {/* Header */}
      <header style={{ background:"#1B5E35", padding:"16px 18px 16px", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontFamily:"serif", fontSize:22, color:"#fff" }}>♔</span>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, color:"#fff", letterSpacing:"0.04em" }}>MY PROFILE</h1>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "4px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <div style={{
              width: 36, height: 36,
              border: "3px solid #1B5E35", borderTopColor: "transparent",
              borderRadius: "50%", animation: "cc-spin 0.9s linear infinite",
            }} />
          </div>
        ) : (
          <>
            {/* ── Player card ─────────────────────────────────── */}
            <div style={{
              background: "#1B5E35",
              borderRadius: 16, padding: 18,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              {/* Avatar */}
              <div style={{
                width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
                background: "rgba(255,255,255,0.15)",
                border: "2px solid rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26,
              }}>
                {av.emoji}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#fff", letterSpacing: "0.03em", lineHeight: 1.1 }}>
                  {fullName?.toUpperCase() || "—"}
                </p>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 }}>
                  {av.name} · {av.class}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {fideTitle && (
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: "#fff", background: "rgba(255,255,255,0.15)",
                      borderRadius: 20, padding: "2px 8px",
                    }}>
                      {fideTitle}
                    </span>
                  )}
                  {currentRating && (
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: "#fff", background: "rgba(255,255,255,0.15)",
                      borderRadius: 20, padding: "2px 8px",
                    }}>
                      ♔ {currentRating}
                    </span>
                  )}
                  {(school || club) && (
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{school ?? club}</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Form ────────────────────────────────────────── */}
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Section title="Personal Information">
                <Field label="Full Name">
                  <input className="cc-input" type="text" value={fullName}
                    onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                </Field>
                <Field label="Email">
                  <input className="cc-input" type="email" value={email} readOnly />
                </Field>
                <Field label="Date of Birth">
                  <input className="cc-input" type="date" value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)} />
                </Field>
              </Section>

              <Section title="Chess Details">
                <Field label="FIDE ID">
                  <input className="cc-input" type="text" value={fideId}
                    onChange={e => setFideId(e.target.value)} placeholder="Your FIDE ID (optional)" />
                </Field>
                <Field label="Admission Number">
                  <input className="cc-input" type="text" value={admissionNumber}
                    onChange={e => setAdmissionNumber(e.target.value)} placeholder="School admission number" />
                </Field>
              </Section>

              <Section title="Guardian / Emergency Contact">
                <Field label="Guardian Name">
                  <input className="cc-input" type="text" value={guardianName}
                    onChange={e => setGuardianName(e.target.value)} placeholder="Parent or guardian name" />
                </Field>
                <Field label="Guardian Phone">
                  <input className="cc-input" type="tel" value={guardianPhone}
                    onChange={e => setGuardianPhone(e.target.value)} placeholder="+254 700 000 000" />
                </Field>
              </Section>

              {/* ── Character picker ─────────────────────────── */}
              <div style={{
                background: "var(--surface)", border: `1px solid rgba(16,185,129,0.15)`,
                borderRadius: 20, overflow: "hidden",
              }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{
                    fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 12,
                    color: "var(--green)", letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>
                    ⚔️ Your Character
                  </p>
                </div>
                <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {AVATARS.map(a => {
                    const selected = avatarId === a.id
                    return (<button
                        key={a.id} type="button"
                        onClick={() => setAvatarId(a.id)}
                        style={{
                          borderRadius: 12, padding: "10px 12px",
                          background:  selected ? `${a.color}10` : "var(--surface-2)",
                          border:      selected ? `2px solid ${a.color}` : "2px solid var(--border)",
                          boxShadow:   selected ? `0 2px 8px ${a.color}30` : "none",
                          cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 20 }}>{a.emoji}</span>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: selected ? a.color : "var(--text)", lineHeight: 1.2 }}>
                              {a.name}
                            </p>
                            <p style={{ fontSize: 10, color: "var(--text-3)" }}>{a.class}</p>
                          </div>
                        </div>
                        <p style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.3 }}>{a.description}</p>
                        {a.unlockLevel > 1 && (
                          <p style={{ fontSize: 9, color: "var(--green)", marginTop: 3, fontWeight: 600 }}>
                            Lv. {a.unlockLevel}+
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
                {/* Selected preview */}
                <div style={{
                  margin: "0 12px 12px",
                  padding: "10px 14px",
                  background: "var(--green-bg)",
                  border: "1px solid var(--green-mid)",
                  borderRadius: 10,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 24 }}>{av.emoji}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
                      {av.name}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-3)" }}>{av.class} · {av.description}</p>
                  </div>
                </div>
              </div>

              {/* ── Board theme picker ───────────────────────── */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Board Theme
                  </p>
                </div>
                <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.values(BOARD_THEMES).map(t => {
                    const selected = boardTheme === t.id
                    return (
                      <button
                        key={t.id} type="button"
                        onClick={() => setBoardTheme(t.id)}
                        style={{
                          borderRadius: 12, padding: "10px 12px",
                          background: selected ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                          border: selected ? "2px solid #1B5E35" : "2px solid rgba(0,0,0,0.08)",
                          cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                          display: "flex", alignItems: "center", gap: 10,
                        }}
                      >
                        {/* Mini board preview */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", width: 32, height: 32, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                          {Array.from({ length: 16 }, (_, i) => (
                            <div key={i} style={{ background: (Math.floor(i / 4) + i) % 2 === 0 ? t.lightSquare : t.darkSquare }} />
                          ))}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--text)" : "var(--text-2)", fontFamily: "var(--cc-font-display)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.displayName}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-3)" }}>{t.emoji}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Piece style picker ───────────────────────── */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Piece Style
                  </p>
                </div>
                <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.values(PIECE_SETS).map(ps => {
                    const selected = pieceSet === ps.id
                    return (
                      <button
                        key={ps.id} type="button"
                        onClick={() => setPieceSet(ps.id)}
                        style={{
                          borderRadius: 12, padding: "10px 14px",
                          background: selected ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                          border: selected ? "2px solid #1B5E35" : "2px solid rgba(0,0,0,0.08)",
                          cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                          display: "flex", alignItems: "center", gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 20, color: ps.whitePiece, textShadow: ps.whiteShadow }}>♔</span>
                        <span style={{ fontSize: 20, color: ps.blackPiece, textShadow: ps.blackShadow }}>♚</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--text)" : "var(--text-2)", fontFamily: "var(--cc-font-display)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ps.displayName}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-3)" }}>{ps.emoji}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Board orientation ────────────────────────── */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Board Orientation
                  </p>
                </div>
                <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Play as White", sub: "Pawns move up ↑", value: false },
                    { label: "Play as Black", sub: "Pawns move down ↓", value: true  },
                  ].map(opt => {
                    const selected = boardFlipped === opt.value
                    return (
                      <button
                        key={String(opt.value)} type="button"
                        onClick={() => setBoardFlipped(opt.value)}
                        style={{
                          borderRadius: 12, padding: "12px 14px",
                          background: selected ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                          border: selected ? "2px solid #1B5E35" : "2px solid rgba(0,0,0,0.08)",
                          cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                        }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--text)" : "var(--text-2)", fontFamily: "var(--cc-font-display)" }}>
                          {opt.label}
                        </p>
                        <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>{opt.sub}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Save feedback ────────────────────────────── */}
              {saveMsg && (
                <div style={{
                  borderRadius: 14, padding: "12px 16px",
                  background: saveMsg.startsWith("Error") ? "rgba(248,113,113,0.08)" : "rgba(16,185,129,0.08)",
                  border: `1px solid ${saveMsg.startsWith("Error") ? "rgba(248,113,113,0.2)" : "rgba(16,185,129,0.2)"}`,
                  color: saveMsg.startsWith("Error") ? "#DC2626" : "#1B5E35",
                  fontSize: 13, fontWeight: 600, textAlign: "center",
                  fontFamily: "var(--cc-font-display)",
                }}>
                  {saveMsg}
                </div>
              )}

              {/* ── Save button ──────────────────────────────── */}
              <button
                type="submit" disabled={saving}
                style={{
                  width: "100%", padding: "14px",
                  background: saving ? "var(--green-bg)" : "var(--green)",
                  border: "none", borderRadius: 14,
                  fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600,
                  color: saving ? "var(--green)" : "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                  letterSpacing: "0.05em",
                  boxShadow: saving ? "none" : "0 4px 20px rgba(16,185,129,0.3)",
                  transition: "all 0.15s",
                }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </form>

            {/* ── Sign Out ─────────────────────────────────── */}
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                width: "100%", padding: "14px",
                background: "rgba(220,38,38,0.08)",
                border: "1px solid rgba(220,38,38,0.2)",
                borderRadius: 14,
                fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600,
                color: "#EF4444",
                cursor: "pointer", letterSpacing: "0.05em",
                transition: "all 0.15s",
                marginBottom: 8,
              }}
            >
              Sign Out
            </button>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
