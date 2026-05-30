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
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 72 }}>
      <header style={{ background: "#1B5E35", padding: "16px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>🏥</span>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#fff", letterSpacing: "0.04em" }}>MEDICAL PROFILE</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>Health info &amp; emergency contacts</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Medical Profile</span>
              <span style={{ fontSize: 10, color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 8px" }}>🔒 Private</span>
            </div>

            {/* Blood type */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 16 }}>
              <label className="cc-label">Blood Type</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {BLOOD_TYPES.map(bt => (
                  <button type="button" key={bt} onClick={() => setBloodType(bt === bloodType ? "" : bt)}
                    style={{ padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: `2px solid ${bloodType === bt ? "#DC2626" : "var(--border-med)"}`, background: bloodType === bt ? "#DC2626" : "var(--surface-2)", color: bloodType === bt ? "#fff" : "var(--text-2)", cursor: "pointer", transition: "all 0.15s" }}>
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            {/* Medical info */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Medical Information</p>
              <TagInput label="Allergies"   items={allergies}   suggestions={COMMON_ALLERGIES}  onChange={setAllergies}   />
              <TagInput label="Conditions"  items={conditions}  suggestions={COMMON_CONDITIONS} onChange={setConditions}  />
              <TagInput label="Medications" items={medications} suggestions={COMMON_MEDS}       onChange={setMedications} />
              <div>
                <label className="cc-label">Additional Notes</label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Any other medical information relevant to coaches and event staff…"
                  className="cc-input"
                  style={{ resize: "none" }}
                />
              </div>
            </div>

            {/* Emergency contacts */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Emergency Contacts</p>
              {[
                { label: "Primary Contact", name: ec1Name, phone: ec1Phone, rel: ec1Rel, setName: setEc1Name, setPhone: setEc1Phone, setRel: setEc1Rel },
                { label: "Secondary Contact", name: ec2Name, phone: ec2Phone, rel: ec2Rel, setName: setEc2Name, setPhone: setEc2Phone, setRel: setEc2Rel },
              ].map((c, i) => (
                <div key={i} style={i > 0 ? { paddingTop: 14, borderTop: "1px solid var(--border)" } : {}}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={c.name}  onChange={e => c.setName(e.target.value)}  placeholder="Full name"          className="cc-input" />
                    <input value={c.phone} onChange={e => c.setPhone(e.target.value)} placeholder="+254 700 000 000"  type="tel"  className="cc-input" />
                    <input value={c.rel}   onChange={e => c.setRel(e.target.value)}   placeholder="Relationship (e.g. Parent)" className="cc-input" />
                  </div>
                </div>
              ))}
            </div>

            {/* Insurance */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Insurance</p>
              <input value={insurance} onChange={e => setInsurance(e.target.value)} placeholder="Insurance provider (optional)" className="cc-input" />
              <input value={insNum}    onChange={e => setInsNum(e.target.value)}    placeholder="Policy number (optional)"     className="cc-input" />
            </div>

            {saved && <div style={{ borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 600, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981" }}>✓ Medical profile saved</div>}

            <button type="submit" disabled={saving || !playerId}
              style={{ width: "100%", padding: 14, background: "linear-gradient(135deg, #0D8A5C, #10B981)", border: "none", borderRadius: 16, fontFamily: "var(--cc-font-display)", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", opacity: (saving || !playerId) ? 0.5 : 1, boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}>
              {saving ? "Saving…" : "Save Medical Profile"}
            </button>
          </form>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
