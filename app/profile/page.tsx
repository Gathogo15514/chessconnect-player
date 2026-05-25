"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { BOARD_THEMES, PIECE_SETS } from "@/components/chess/themes"
import type { ThemeId, PieceSetId } from "@/components/chess/themes"
import { AVATARS, getAvatar } from "@/lib/avatars"
import type { AvatarId } from "@/lib/avatars"

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

      // load cosmetic preferences
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
          fide_id:          fideId     || null,
          admission_number: admissionNumber || null,
          date_of_birth:    dateOfBirth    || null,
          guardian_name:    guardianName   || null,
          guardian_phone:   guardianPhone  || null,
        })
        .eq("id", playerId)
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
          .insert({
            player_id: playerId, board_theme: boardTheme, piece_set: pieceSet,
            board_flipped: boardFlipped, avatar_id: avatarId,
            current_level: 1, total_xp: 0,
            gold_balance: 0, streak_current: 0, streak_shields: 0,
            level_xp_start: 0, level_xp_threshold: 100,
          })
        if (gpErr) errors.push(gpErr.message)
      }
    }

    setSaveMsg(errors.length ? `Error: ${errors.join("; ")}` : "Saved successfully!")
    setSaving(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-lg">My Profile</span>
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
            {/* Summary card */}
            <div className="bg-green-900 rounded-2xl p-5 mb-5 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400/40 flex items-center justify-center text-3xl flex-shrink-0">
                {fullName ? fullName[0]?.toUpperCase() : "?"}
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">{fullName || "—"}</p>
                <p className="text-green-300 text-sm">{email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {fideTitle && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 uppercase">{fideTitle}</span>
                  )}
                  {currentRating && (
                    <span className="text-[10px] text-green-300">Rating: {currentRating}</span>
                  )}
                  {(school || club) && (
                    <span className="text-[10px] text-green-300">{school ?? club}</span>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4 shadow-sm">
                <h2 className="font-bold text-stone-800 text-sm">Personal Information</h2>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Full Name</label>
                  <input
                    type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Email</label>
                  <input
                    type="email" value={email} readOnly
                    className="w-full rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-sm text-stone-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Date of Birth</label>
                  <input
                    type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4 shadow-sm">
                <h2 className="font-bold text-stone-800 text-sm">Chess Details</h2>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">FIDE ID</label>
                  <input
                    type="text" value={fideId} onChange={e => setFideId(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                    placeholder="Your FIDE ID (optional)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Admission Number</label>
                  <input
                    type="text" value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                    placeholder="School admission number"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4 shadow-sm">
                <h2 className="font-bold text-stone-800 text-sm">Guardian / Emergency Contact</h2>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Guardian Name</label>
                  <input
                    type="text" value={guardianName} onChange={e => setGuardianName(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                    placeholder="Parent or guardian name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Guardian Phone</label>
                  <input
                    type="tel" value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
                    placeholder="+254 700 000 000"
                  />
                </div>
              </div>

              {/* Avatar / Character picker */}
              <div style={{ background: "#0f172a", borderRadius: 16, padding: 16, border: "1px solid rgba(16,185,129,0.15)" }}>
                <h2 className="font-bold text-sm mb-3" style={{ color: "#10b981" }}>⚔️ Your Character</h2>
                <div className="grid grid-cols-2 gap-2">
                  {AVATARS.map(av => {
                    const selected = avatarId === av.id
                    const locked   = false // level check optional — kept open for all for now
                    return (
                      <button
                        key={av.id} type="button"
                        onClick={() => !locked && setAvatarId(av.id)}
                        style={{
                          borderRadius: 12, padding: "10px 12px",
                          background:  selected ? `rgba(${av.glow ? "16,185,129" : "255,255,255"},0.08)` : "rgba(255,255,255,0.04)",
                          border:      `2px solid ${selected ? av.color : "rgba(255,255,255,0.08)"}`,
                          boxShadow:   selected ? `0 0 12px ${av.glow}` : "none",
                          cursor:      "pointer", textAlign: "left", transition: "all 0.15s",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: 22 }}>{av.emoji}</span>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: selected ? av.color : "#e2e8f0", lineHeight: 1.2 }}>{av.name}</p>
                            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{av.class}</p>
                          </div>
                        </div>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.3 }}>{av.description}</p>
                        {av.unlockLevel > 1 && (
                          <p style={{ fontSize: 9, color: av.color, marginTop: 4, opacity: 0.7 }}>Lv. {av.unlockLevel}+</p>
                        )}
                      </button>
                    )
                  })}
                </div>
                {(() => { const av = getAvatar(avatarId); return (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{av.emoji}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: av.color }}>{av.name}</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{av.class} · {av.description}</p>
                    </div>
                  </div>
                )})()}
              </div>

              {/* Board theme picker */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4 shadow-sm">
                <h2 className="font-bold text-stone-800 text-sm">Board Theme</h2>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.values(BOARD_THEMES)).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setBoardTheme(t.id)}
                      className={`rounded-xl border-2 p-2 flex items-center gap-2 transition-all ${
                        boardTheme === t.id
                          ? "border-green-700 bg-green-50"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      {/* mini board preview */}
                      <div className="grid grid-cols-4 w-8 h-8 rounded overflow-hidden flex-shrink-0">
                        {Array.from({ length: 16 }, (_, i) => (
                          <div key={i} style={{ background: (Math.floor(i / 4) + i) % 2 === 0 ? t.lightSquare : t.darkSquare }} />
                        ))}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-semibold text-stone-800 leading-tight truncate">{t.displayName}</p>
                        <p className="text-[10px] text-stone-400">{t.emoji}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Piece set picker */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4 shadow-sm">
                <h2 className="font-bold text-stone-800 text-sm">Piece Style</h2>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.values(PIECE_SETS)).map(ps => (
                    <button
                      key={ps.id}
                      type="button"
                      onClick={() => setPieceSet(ps.id)}
                      className={`rounded-xl border-2 p-3 flex items-center gap-2 transition-all ${
                        pieceSet === ps.id
                          ? "border-green-700 bg-green-50"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <span className="text-xl" style={{ color: ps.whitePiece, textShadow: ps.whiteShadow }}>♔</span>
                      <span className="text-xl" style={{ color: ps.blackPiece, textShadow: ps.blackShadow }}>♚</span>
                      <div className="text-left min-w-0 ml-1">
                        <p className="text-xs font-semibold text-stone-800 leading-tight truncate">{ps.displayName}</p>
                        <p className="text-[10px] text-stone-400">{ps.emoji}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Board orientation */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
                <h2 className="font-bold text-stone-800 text-sm mb-3">Default Board Orientation</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Play as White", sub: "Pawns move up ↑", value: false },
                    { label: "Play as Black", sub: "Pawns move down ↓", value: true  },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setBoardFlipped(opt.value)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        boardFlipped === opt.value
                          ? "border-green-700 bg-green-50"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <p className="text-xs font-semibold text-stone-800">{opt.label}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {saveMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${saveMsg.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {saveMsg}
                </div>
              )}

              <button
                type="submit" disabled={saving}
                className="w-full bg-green-800 text-white rounded-xl py-3 text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
