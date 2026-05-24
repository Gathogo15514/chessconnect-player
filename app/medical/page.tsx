"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

const BLOOD_TYPES       = ["A+","A−","B+","B−","AB+","AB−","O+","O−"]
const COMMON_ALLERGIES  = ["Penicillin","Aspirin","Ibuprofen","Latex","Peanuts","Eggs","Milk","Bee stings","Dust","Pollen"]
const COMMON_CONDITIONS = ["Asthma","Diabetes (Type 1)","Diabetes (Type 2)","Epilepsy","Hypertension","Heart condition","Sickle cell","Anxiety","Migraines"]
const COMMON_MEDS       = ["Salbutamol inhaler","Insulin","Metformin","Paracetamol","Antihistamine","Eye drops"]

function TagInput({ label, items, suggestions, onChange }: {
  label: string; items: string[]; suggestions: string[]; onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState("")
  function add(v: string) {
    const t = v.trim()
    if (t && !items.includes(t)) onChange([...items, t])
    setInput("")
  }
  return (
    <div>
      <label className="block text-xs font-bold text-stone-500 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {items.map(item => (
          <span key={item} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
            {item}
            <button type="button" onClick={() => onChange(items.filter(i => i !== item))} className="text-stone-400 hover:text-stone-700 leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input) } }}
          placeholder={`Add ${label.toLowerCase()}…`}
          className="flex-1 h-9 px-3 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-green-700"
        />
        <button type="button" onClick={() => add(input)} className="px-3 h-9 rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50 text-lg leading-none">+</button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.filter(s => !items.includes(s)).slice(0, 5).map(s => (
            <button type="button" key={s} onClick={() => add(s)}
              className="text-[11px] px-2 py-0.5 rounded-full bg-stone-50 border border-stone-200 text-stone-500 hover:bg-stone-100">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MedicalPage() {
  const router  = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [playerId,  setPlayerId]  = useState<string | null>(null)
  const [hasRecord, setHasRecord] = useState(false)

  const [bloodType,   setBloodType]   = useState("")
  const [allergies,   setAllergies]   = useState<string[]>([])
  const [conditions,  setConditions]  = useState<string[]>([])
  const [medications, setMedications] = useState<string[]>([])
  const [ec1Name,     setEc1Name]     = useState("")
  const [ec1Phone,    setEc1Phone]    = useState("")
  const [ec1Rel,      setEc1Rel]      = useState("")
  const [ec2Name,     setEc2Name]     = useState("")
  const [ec2Phone,    setEc2Phone]    = useState("")
  const [ec2Rel,      setEc2Rel]      = useState("")
  const [notes,       setNotes]       = useState("")
  const [insurance,   setInsurance]   = useState("")
  const [insNum,      setInsNum]      = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pl } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!pl) { setLoading(false); return }
      setPlayerId(pl.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: med } = await (supabase.from("player_medical_profiles") as any)
        .select("*").eq("player_id", pl.id).maybeSingle()
      if (med) {
        setHasRecord(true)
        setBloodType(med.blood_type ?? "")
        setAllergies(med.allergies ?? [])
        setConditions(med.conditions ?? [])
        setMedications(med.medications ?? [])
        setEc1Name(med.emergency_contact_1_name ?? "")
        setEc1Phone(med.emergency_contact_1_phone ?? "")
        setEc1Rel(med.emergency_contact_1_relation ?? "")
        setEc2Name(med.emergency_contact_2_name ?? "")
        setEc2Phone(med.emergency_contact_2_phone ?? "")
        setEc2Rel(med.emergency_contact_2_relation ?? "")
        setNotes(med.medical_notes ?? "")
        setInsurance(med.insurance_provider ?? "")
        setInsNum(med.insurance_number ?? "")
      }
      setLoading(false)
    })
  }, [router])

  async function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!playerId) return
    setSaving(true); setSaved(false)
    const supabase = createClient()
    const payload = {
      player_id:                   playerId,
      blood_type:                  bloodType || null,
      allergies, conditions, medications,
      emergency_contact_1_name:    ec1Name  || null,
      emergency_contact_1_phone:   ec1Phone || null,
      emergency_contact_1_relation:ec1Rel   || null,
      emergency_contact_2_name:    ec2Name  || null,
      emergency_contact_2_phone:   ec2Phone || null,
      emergency_contact_2_relation:ec2Rel   || null,
      medical_notes:               notes    || null,
      insurance_provider:          insurance|| null,
      insurance_number:            insNum   || null,
    }
    if (hasRecord) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("player_medical_profiles") as any).update(payload).eq("player_id", playerId)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("player_medical_profiles") as any).insert(payload)
      setHasRecord(true)
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
          <span className="font-bold text-lg">Medical</span>
        </div>
        <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white">Sign out</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl font-bold text-stone-900">Medical Profile</h1>
              <span className="text-xs text-stone-400 bg-stone-100 px-2 py-1 rounded-lg">🔒 Private</span>
            </div>

            {/* Blood type */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
              <label className="block text-xs font-bold text-stone-500 mb-2">Blood Type</label>
              <div className="flex flex-wrap gap-2">
                {BLOOD_TYPES.map(bt => (
                  <button type="button" key={bt} onClick={() => setBloodType(bt === bloodType ? "" : bt)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors ${
                      bloodType === bt ? "bg-red-600 text-white border-red-600" : "bg-stone-50 text-stone-700 border-stone-200 hover:border-red-300"
                    }`}>
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            {/* Medical info */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-4">
              <h2 className="font-bold text-stone-800 text-sm">Medical Information</h2>
              <TagInput label="Allergies"   items={allergies}   suggestions={COMMON_ALLERGIES}  onChange={setAllergies}   />
              <TagInput label="Conditions"  items={conditions}  suggestions={COMMON_CONDITIONS} onChange={setConditions}  />
              <TagInput label="Medications" items={medications} suggestions={COMMON_MEDS}       onChange={setMedications} />
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1.5">Additional Notes</label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Any other medical information relevant to coaches and event staff…"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 resize-none"
                />
              </div>
            </div>

            {/* Emergency contacts */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-4">
              <h2 className="font-bold text-stone-800 text-sm">Emergency Contacts</h2>
              {[
                { label: "Primary Contact", name: ec1Name, phone: ec1Phone, rel: ec1Rel, setName: setEc1Name, setPhone: setEc1Phone, setRel: setEc1Rel },
                { label: "Secondary Contact", name: ec2Name, phone: ec2Phone, rel: ec2Rel, setName: setEc2Name, setPhone: setEc2Phone, setRel: setEc2Rel },
              ].map((c, i) => (
                <div key={i} className={i > 0 ? "pt-4 border-t border-stone-100" : ""}>
                  <p className="text-xs font-bold text-stone-500 mb-2">{c.label}</p>
                  <div className="space-y-2">
                    <input value={c.name}  onChange={e => c.setName(e.target.value)}  placeholder="Full name"          className="w-full h-9 px-3 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-green-700" />
                    <input value={c.phone} onChange={e => c.setPhone(e.target.value)} placeholder="+254 700 000 000"  type="tel"  className="w-full h-9 px-3 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-green-700" />
                    <input value={c.rel}   onChange={e => c.setRel(e.target.value)}   placeholder="Relationship (e.g. Parent)" className="w-full h-9 px-3 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-green-700" />
                  </div>
                </div>
              ))}
            </div>

            {/* Insurance */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-2">
              <h2 className="font-bold text-stone-800 text-sm mb-2">Insurance</h2>
              <input value={insurance} onChange={e => setInsurance(e.target.value)} placeholder="Insurance provider (optional)" className="w-full h-9 px-3 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-green-700" />
              <input value={insNum}    onChange={e => setInsNum(e.target.value)}    placeholder="Policy number (optional)"     className="w-full h-9 px-3 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-green-700" />
            </div>

            {saved && <div className="rounded-xl px-4 py-3 text-sm font-medium bg-emerald-50 text-emerald-700">✓ Medical profile saved</div>}

            <button type="submit" disabled={saving || !playerId}
              className="w-full bg-green-800 text-white rounded-xl py-3 text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save Medical Profile"}
            </button>
          </form>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
