"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BoardSettingsPanel } from "@/components/chess/BoardSettingsPanel"

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

            {saveMsg && (
              <div className={"rounded-xl border p-3 text-center text-[13px] font-semibold " + (saveMsg.startsWith("Error") ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary")}>
                {saveMsg}
              </div>
            )}

            <Button type="submit" disabled={saving} size="lg" className="w-full">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>

          {/* Board settings apply live (no Save needed) — separate from the form above. */}
          <div>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Board settings</p>
            <BoardSettingsPanel />
          </div>

          <Button type="button" variant="outline" onClick={handleSignOut} className="w-full border-destructive/20 text-destructive hover:bg-destructive/5">
            Sign out
          </Button>
        </div>
      )}
    </AppShell>
  )
}
