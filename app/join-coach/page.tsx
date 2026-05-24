"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

type CoachLink = {
  id:         string
  status:     string
  linked_via: string | null
  created_at: string
  coaches?:   { profiles?: { full_name?: string | null } | null } | null
}

const LINK_STATUS: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  pending:  "bg-amber-100 text-amber-700",
  inactive: "bg-stone-100 text-stone-500",
  revoked:  "bg-red-100 text-red-600",
}

export default function JoinCoachPage() {
  const router = useRouter()
  const [playerId,   setPlayerId]   = useState<string | null>(null)
  const [links,      setLinks]      = useState<CoachLink[]>([])
  const [code,       setCode]       = useState("")
  const [joining,    setJoining]    = useState(false)
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pl } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).eq("is_active", true).maybeSingle()

      if (pl) {
        setPlayerId(pl.id)
        await refreshLinks(supabase, pl.id)
      }
      setLoading(false)
    })
  }, [router])

  async function refreshLinks(supabase: ReturnType<typeof createClient>, pid: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("coach_player_links") as any)
      .select("id, status, linked_via, created_at, coaches(id, profiles(full_name))")
      .eq("player_id", pid).neq("status", "revoked")
      .order("created_at", { ascending: false })
    setLinks(data ?? [])
  }

  async function handleJoin() {
    if (!code.trim() || !playerId) return
    setJoining(true)
    setMsg(null)

    const supabase = createClient()
    const { data: result, error } = await supabase.rpc("redeem_invite_code", {
      p_code:      code.trim().toUpperCase(),
      p_player_id: playerId,
    })

    if (error) {
      setMsg({ ok: false, text: error.message ?? "Something went wrong. Please try again." })
      setJoining(false)
      return
    }

    const res = result as { ok: boolean; reason?: string; status?: string; needs_parent_approval?: boolean }

    if (!res.ok) {
      const messages: Record<string, string> = {
        invalid_code:     "This code doesn't exist or has been deactivated. Check the code and try again.",
        expired:          "This invite code has expired. Ask your coach to generate a new one.",
        max_uses_reached: "This invite code has reached its maximum uses. Ask your coach for a new code.",
        already_linked:   "You are already linked to this coach.",
        player_not_found: "Your player profile could not be found. Contact your admin.",
      }
      setMsg({ ok: false, text: messages[res.reason ?? ""] ?? "Could not redeem code. Please try again." })
    } else {
      const needsApproval = res.needs_parent_approval ?? res.status === "pending"
      setMsg({
        ok: true,
        text: needsApproval
          ? "✅ Request sent! Your parent/guardian needs to approve the connection."
          : "✅ You are now connected to your coach!",
      })
      setCode("")
      await refreshLinks(supabase, playerId)
    }
    setJoining(false)
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
          <span className="font-bold text-lg">Join a Coach</span>
        </div>
        <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white">Sign out</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !playerId ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="mt-3 text-amber-800 font-medium">No player profile found</p>
            <p className="text-sm text-amber-700 mt-1">Ask your club or school admin to create your player profile first.</p>
          </div>
        ) : (
          <>
            {/* Current coaches */}
            {links.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100">
                  <h2 className="font-bold text-stone-800">My Coaches</h2>
                </div>
                {links.map((l, i) => (
                  <div key={l.id} className={`flex items-center gap-3 px-4 py-3 ${i < links.length - 1 ? "border-b border-stone-50" : ""}`}>
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg flex-shrink-0">
                      👨‍🏫
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 truncate">
                        {l.coaches?.profiles?.full_name ?? "Coach"}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        Via {l.linked_via ?? "direct"} · {new Date(l.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${LINK_STATUS[l.status] ?? "bg-stone-100 text-stone-500"}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Join by invite code */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
              <div>
                <h2 className="font-bold text-stone-800">Enter Invite Code</h2>
                <p className="text-xs text-stone-400 mt-0.5">Ask your coach for their invite code — it looks like GUILD-KNIGHT-402.</p>
              </div>

              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") handleJoin() }}
                placeholder="GUILD-KNIGHT-402"
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-green-700 uppercase tracking-widest"
                maxLength={24}
                disabled={joining}
              />

              <button
                onClick={handleJoin}
                disabled={joining || !code.trim()}
                className="w-full py-2.5 bg-green-800 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                {joining ? "Connecting…" : "Join Coach"}
              </button>

              {msg && (
                <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {msg.text}
                </div>
              )}
            </div>

            {links.length === 0 && (
              <div className="bg-stone-50 rounded-2xl border border-dashed border-stone-300 p-8 text-center">
                <span className="text-4xl">👨‍🏫</span>
                <p className="mt-3 text-stone-500 text-sm font-medium">No coaches yet</p>
                <p className="text-xs text-stone-400 mt-1">Enter your coach's invite code above to connect.</p>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
