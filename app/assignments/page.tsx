import { createClient }   from "@/lib/supabase/server"
import { redirect }        from "next/navigation"
import Link                from "next/link"

const MAIN_API = process.env.NEXT_PUBLIC_MAIN_API_URL ?? ""

type Assignment = {
  result_id:          string
  assignment_id:      string
  player_status:      string
  title:              string
  description?:       string | null
  difficulty?:        string | null
  due_date?:          string | null
  estimated_minutes?: number | null
  passing_score:      number
  total_exercises:    number
  topic?:             { title: string; icon: string } | null
}

const DIFF_COLOR: Record<string, string> = {
  beginner:     "bg-green-100 text-green-800",
  intermediate: "bg-amber-100 text-amber-800",
  advanced:     "bg-purple-100 text-purple-800",
}

export default async function AssignmentsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  let assignments: Assignment[] = []
  try {
    // Use Bearer token — safe for cross-origin, no ISO-8859-1 issues
    const res = await fetch(`${MAIN_API}/api/v1/player/assignments/active`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache:   "no-store",
    })
    if (res.ok) {
      const data = await res.json()
      assignments = data.assignments ?? []
    }
  } catch { /* offline — show empty state */ }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Nav */}
      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-lg">ChessConnect</span>
        </div>
        <form action="/auth/signout" method="POST">
          <button className="text-sm text-green-200 hover:text-white">Sign out</button>
        </form>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-stone-900 mb-1">My Assignments</h1>
        <p className="text-sm text-stone-500 mb-6">
          {assignments.length} active {assignments.length === 1 ? "assignment" : "assignments"}
        </p>

        {assignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <span className="text-4xl">♜</span>
            <p className="mt-3 text-stone-600 font-medium">No assignments yet</p>
            <p className="text-sm text-stone-400 mt-1">Your coach will assign puzzles here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => (
              <Link key={a.result_id} href={`/assignments/${a.assignment_id}`}>
                <div className="bg-white rounded-2xl border border-stone-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {a.topic && (
                        <p className="text-xs text-stone-400 mb-0.5">{a.topic.icon} {a.topic.title}</p>
                      )}
                      <p className="font-semibold text-stone-900 truncate">{a.title}</p>
                      {a.description && (
                        <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">{a.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {a.difficulty && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_COLOR[a.difficulty] ?? "bg-stone-100 text-stone-700"}`}>
                            {a.difficulty}
                          </span>
                        )}
                        <span className="text-xs text-stone-400">{a.total_exercises} exercises</span>
                        {a.estimated_minutes && (
                          <span className="text-xs text-stone-400">~{a.estimated_minutes}m</span>
                        )}
                        {a.due_date && (
                          <span className="text-xs text-amber-600">Due {new Date(a.due_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium mt-0.5 ${
                      a.player_status === "in_progress"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-stone-100 text-stone-600"
                    }`}>
                      {a.player_status === "in_progress" ? "In Progress" : "Start"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
