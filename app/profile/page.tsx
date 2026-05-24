"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

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
