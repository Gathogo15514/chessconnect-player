"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"]
const COMMON_ALLERGIES = ["Penicillin", "Aspirin", "Ibuprofen", "Latex", "Peanuts", "Eggs", "Milk", "Bee stings", "Dust", "Pollen"]
const COMMON_CONDITIONS = ["Asthma", "Diabetes (Type 1)", "Diabetes (Type 2)", "Epilepsy", "Hypertension", "Heart condition", "Sickle cell", "Anxiety", "Migraines"]
const COMMON_MEDS = ["Salbutamol inhaler", "Insulin", "Metformin", "Paracetamol", "Antihistamine", "Eye drops"]

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
      <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{label}</label>
      <div className="mb-2 flex min-h-[28px] flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
            {item}
            <button type="button" onClick={() => onChange(items.filter(i => i !== item))} className="leading-none text-muted-foreground hover:text-foreground">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input) } }} placeholder={`Add ${label.toLowerCase()}…`} />
        <Button type="button" variant="outline" onClick={() => add(input)}>+</Button>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.filter(s => !items.includes(s)).slice(0, 5).map(s => (
            <button type="button" key={s} onClick={() => add(s)} className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MedicalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [hasRecord, setHasRecord] = useState(false)

  const [bloodType, setBloodType] = useState("")
  const [allergies, setAllergies] = useState<string[]>([])
  const [conditions, setConditions] = useState<string[]>([])
  const [medications, setMedications] = useState<string[]>([])
  const [ec1Name, setEc1Name] = useState("")
  const [ec1Phone, setEc1Phone] = useState("")
  const [ec1Rel, setEc1Rel] = useState("")
  const [ec2Name, setEc2Name] = useState("")
  const [ec2Phone, setEc2Phone] = useState("")
  const [ec2Rel, setEc2Rel] = useState("")
  const [notes, setNotes] = useState("")
  const [insurance, setInsurance] = useState("")
  const [insNum, setInsNum] = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pl } = await (supabase.from("players") as any).select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!pl) { setLoading(false); return }
      setPlayerId(pl.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: med } = await (supabase.from("player_medical_profiles") as any).select("*").eq("player_id", pl.id).maybeSingle()
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
      player_id: playerId,
      blood_type: bloodType || null,
      allergies, conditions, medications,
      emergency_contact_1_name: ec1Name || null,
      emergency_contact_1_phone: ec1Phone || null,
      emergency_contact_1_relation: ec1Rel || null,
      emergency_contact_2_name: ec2Name || null,
      emergency_contact_2_phone: ec2Phone || null,
      emergency_contact_2_relation: ec2Rel || null,
      medical_notes: notes || null,
      insurance_provider: insurance || null,
      insurance_number: insNum || null,
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

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Health info &amp; emergency contacts</p>
          <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Medical profile</h1>
        </div>
        <span className="flex items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-1 text-[11px] text-muted-foreground"><Lock size={11} /> Private</span>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-4">
          <Card className="p-4">
            <label className="mb-2 block text-[12px] font-semibold text-muted-foreground">Blood type</label>
            <div className="flex flex-wrap gap-2">
              {BLOOD_TYPES.map(bt => (
                <button
                  key={bt} type="button" onClick={() => setBloodType(bt === bloodType ? "" : bt)}
                  className={"rounded-lg border-2 px-3.5 py-1.5 text-[13px] font-bold transition-colors " + (bloodType === bt ? "border-destructive bg-destructive text-white" : "border-border bg-secondary text-muted-foreground")}
                >
                  {bt}
                </button>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Medical information</p>
            <TagInput label="Allergies" items={allergies} suggestions={COMMON_ALLERGIES} onChange={setAllergies} />
            <TagInput label="Conditions" items={conditions} suggestions={COMMON_CONDITIONS} onChange={setConditions} />
            <TagInput label="Medications" items={medications} suggestions={COMMON_MEDS} onChange={setMedications} />
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Additional notes</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Any other medical information relevant to coaches and event staff…"
                className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-[13.5px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Emergency contacts</p>
            {[
              { label: "Primary contact", name: ec1Name, phone: ec1Phone, rel: ec1Rel, setName: setEc1Name, setPhone: setEc1Phone, setRel: setEc1Rel },
              { label: "Secondary contact", name: ec2Name, phone: ec2Phone, rel: ec2Rel, setName: setEc2Name, setPhone: setEc2Phone, setRel: setEc2Rel },
            ].map((c, i) => (
              <div key={i} className={i > 0 ? "border-t border-border pt-4" : ""}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <div className="flex flex-col gap-2">
                  <Input value={c.name} onChange={e => c.setName(e.target.value)} placeholder="Full name" />
                  <Input value={c.phone} onChange={e => c.setPhone(e.target.value)} placeholder="+254 700 000 000" type="tel" />
                  <Input value={c.rel} onChange={e => c.setRel(e.target.value)} placeholder="Relationship (e.g. Parent)" />
                </div>
              </div>
            ))}
          </Card>

          <Card className="flex flex-col gap-2.5 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Insurance</p>
            <Input value={insurance} onChange={e => setInsurance(e.target.value)} placeholder="Insurance provider (optional)" />
            <Input value={insNum} onChange={e => setInsNum(e.target.value)} placeholder="Policy number (optional)" />
          </Card>

          {saved && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center text-[13px] font-semibold text-primary">
              Medical profile saved
            </div>
          )}

          <Button type="submit" disabled={saving || !playerId} size="lg" className="w-full">
            {saving ? "Saving…" : "Save medical profile"}
          </Button>
        </form>
      )}
    </AppShell>
  )
}
