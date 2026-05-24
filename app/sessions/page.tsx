"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

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

const STATUS_BG: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700",
  late:    "bg-amber-100 text-amber-700",
  excused: "bg-blue-100 text-blue-700",
  absent:  "bg-red-100 text-red-600",
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

      if (err) { setError(err.message); } else { setAttendance(data ?? []) }
      setLoading(false)
    })
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const present = attendance.filter(a => a.status === "present").length
  const total   = attendance.length
  const pct     = total > 0 ? Math.round((present / total) * 100) : null

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-lg">Sessions</span>
        </div>
        <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white">Sign out</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-700 font-medium">Could not load sessions</p>
            <p className="text-sm text-red-500 mt-1">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h1 className="text-xl font-bold text-stone-900">My Sessions</h1>
              {pct !== null && (
                <p className="text-sm text-stone-500 mt-0.5">
                  {present} of {total} attended · {pct}% rate
                </p>
              )}
            </div>

            {attendance.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-4xl">📅</span>
                <p className="mt-3 text-stone-600 font-medium">No sessions yet</p>
                <p className="text-sm text-stone-400 mt-1">Your attendance will appear here once your coach marks sessions.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                {attendance.map((a, i) => (
                  <div key={i} className={`px-4 py-3 flex items-start justify-between gap-3 ${i < attendance.length - 1 ? "border-b border-stone-100" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 truncate">
                        {a.sessions?.title ?? "Session"}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {a.sessions?.session_date
                          ? new Date(a.sessions.session_date).toLocaleDateString("en-KE", {
                              weekday:"short", day:"numeric", month:"short", year:"numeric"
                            })
                          : "—"}
                        {a.sessions?.start_time ? ` · ${a.sessions.start_time.slice(0, 5)}` : ""}
                        {a.sessions?.coaches?.profiles?.full_name
                          ? ` · ${a.sessions.coaches.profiles.full_name}`
                          : ""}
                      </p>
                      {a.sessions?.topic && (
                        <p className="text-xs text-stone-400 italic mt-0.5">{a.sessions.topic}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_BG[a.status] ?? "bg-stone-100 text-stone-500"}`}>
                        {a.status}
                      </span>
                      {a.method && (
                        <span className="text-[10px] text-stone-400 capitalize">{a.method}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
