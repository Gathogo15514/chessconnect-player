"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BOARD_THEMES, PIECE_SETS } from "@/components/chess/themes"
import type { ThemeId, PieceSetId } from "@/components/chess/themes"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-border p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="flex flex-col gap-3.5 p-4">{children}</div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function ChoiceGrid<T extends string | boolean>({
  options, selected, onSelect,
}: {
  options: { id: T; render: React.ReactNode }[]
  selected: T
  onSelect: (id: T) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(o => (
        <button
          key={String(o.id)} type="button" onClick={() => onSelect(o.id)}
          className={
            "rounded-xl border-2 p-2.5 text-left transition-colors " +
            (selected === o.id ? "border-primary bg-primary/5" : "border-border bg-transparent hover:bg-secondary")
          }
        >
          {o.render}
        </button>
      ))}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [fideId, setFideId] = useState("")
  const [admissionNumber, setAdmissionNumber] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [guardianName, setGuardianName] = useState("")
  const [guardianPhone, setGuardianPhone] = useState("")
  const [school, setSchool] = useState<string | null>(null)
  const [club, setClub] = useState<string | null>(null)
  const [currentRating, setCurrentRating] = useState<number | null>(null)
  const [boardTheme, setBoardTheme] = useState<ThemeId>("classic")
  const [pieceSet, setPieceSet] = useState<PieceSetId>("standard")
  const [boardFlipped, setBoardFlipped] = useState(false)

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
          .select("id, fide_id, current_rating, admission_number, date_of_birth, guardian_name, guardian_phone, schools(name), clubs(name)")
          .eq("profile_id", session.user.id).maybeSingle(),
      ])

      if (playerRes.data?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: gp } = await (supabase.from("player_game_profiles") as any)
          .select("board_theme, piece_set, board_flipped").eq("player_id", playerRes.data.id).maybeSingle()
        if (gp?.board_theme) setBoardTheme(gp.board_theme as ThemeId)
        if (gp?.piece_set) setPieceSet(gp.piece_set as PieceSetId)
        if (typeof gp?.board_flipped === "boolean") setBoardFlipped(gp.board_flipped)
      }

      setFullName(profileRes.data?.full_name ?? "")
      const pl = playerRes.data
      if (pl) {
        setPlayerId(pl.id)
        setFideId(pl.fide_id ?? "")
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_MAIN_API_URL ?? ""}/api/player/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          fide_id: fideId || null,
          date_of_birth: dateOfBirth || null,
          guardian_name: guardianName || null,
          guardian_phone: guardianPhone || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        errors.push(json.error ?? "Failed to update profile.")
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gpExists } = await (supabase.from("player_game_profiles") as any)
        .select("player_id").eq("player_id", playerId).maybeSingle()
      const themePayload = { board_theme: boardTheme, piece_set: pieceSet, board_flipped: boardFlipped }
      if (gpExists) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: gpErr } = await (supabase.from("player_game_profiles") as any)
          .update(themePayload).eq("player_id", playerId)
        if (gpErr) errors.push(gpErr.message)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: gpErr } = await (supabase.from("player_game_profiles") as any)
          .insert({ player_id: playerId, ...themePayload })
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

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">Your account</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Profile</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          {/* Identity card */}
          <div className="flex items-center gap-4 rounded-2xl bg-brand-green p-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 font-serif text-xl font-bold text-white">
              {fullName.split(" ").map(n => n[0]).slice(0, 2).join("") || "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate font-serif text-lg font-bold text-white">{fullName || "—"}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {currentRating && (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">Rating {currentRating}</span>
                )}
                {(school || club) && <span className="text-[12px] text-white/65">{school ?? club}</span>}
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Section title="Personal information">
              <Field label="Full name">
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
              </Field>
              <Field label="Email">
                <Input type="email" value={email} readOnly className="opacity-60" />
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
              </Field>
            </Section>

            <Section title="Chess details">
              <Field label="FIDE ID">
                <Input value={fideId} onChange={e => setFideId(e.target.value)} placeholder="Your FIDE ID (optional)" />
              </Field>
              <Field label="Admission number">
                <Input value={admissionNumber || "—"} readOnly className="cursor-not-allowed opacity-60" title="Set by your school." />
              </Field>
            </Section>

            <Section title="Guardian / emergency contact">
              <Field label="Guardian name">
                <Input value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder="Parent or guardian name" />
              </Field>
              <Field label="Guardian phone">
                <Input type="tel" value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="+254 700 000 000" />
              </Field>
            </Section>

            <Section title="Board theme">
              <ChoiceGrid
                selected={boardTheme}
                onSelect={setBoardTheme}
                options={Object.values(BOARD_THEMES).map(t => ({
                  id: t.id,
                  render: (
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 shrink-0 grid-cols-4 overflow-hidden rounded-md">
                        {Array.from({ length: 16 }, (_, i) => (
                          <div key={i} style={{ background: (Math.floor(i / 4) + i) % 2 === 0 ? t.lightSquare : t.darkSquare }} />
                        ))}
                      </div>
                      <p className="truncate text-[12.5px] font-semibold text-foreground">{t.displayName}</p>
                    </div>
                  ),
                }))}
              />
            </Section>

            <Section title="Piece style">
              <ChoiceGrid
                selected={pieceSet}
                onSelect={setPieceSet}
                options={Object.values(PIECE_SETS).map(ps => ({
                  id: ps.id,
                  render: (
                    <div className="flex items-center gap-2">
                      <span className="text-xl" style={{ color: ps.whitePiece, textShadow: ps.whiteShadow }}>♔</span>
                      <span className="text-xl" style={{ color: ps.blackPiece, textShadow: ps.blackShadow }}>♚</span>
                      <p className="truncate text-[12.5px] font-semibold text-foreground">{ps.displayName}</p>
                    </div>
                  ),
                }))}
              />
            </Section>

            <Section title="Board orientation">
              <ChoiceGrid
                selected={boardFlipped}
                onSelect={setBoardFlipped}
                options={[
                  { id: false, render: <><p className="text-[12.5px] font-semibold text-foreground">Play as White</p><p className="mt-0.5 text-[11px] text-muted-foreground">Pawns move up</p></> },
                  { id: true, render: <><p className="text-[12.5px] font-semibold text-foreground">Play as Black</p><p className="mt-0.5 text-[11px] text-muted-foreground">Pawns move down</p></> },
                ]}
              />
            </Section>

            {saveMsg && (
              <div className={"rounded-xl border p-3 text-center text-[13px] font-semibold " + (saveMsg.startsWith("Error") ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary")}>
                {saveMsg}
              </div>
            )}

            <Button type="submit" disabled={saving} size="lg" className="w-full">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>

          <Button type="button" variant="outline" onClick={handleSignOut} className="w-full border-destructive/20 text-destructive hover:bg-destructive/5">
            Sign out
          </Button>
        </div>
      )}
    </AppShell>
  )
}
