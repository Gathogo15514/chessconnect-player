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
  coaches?:   { profiles?: { full_name?: string | null; avatar_url?: string | null } | null } | null
}

type CoachResult = {
  id:         string
  invite_code?: string | null
  profiles?:  { full_name?: string | null } | null
}

const LINK_STATUS: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  pending:  "bg-amber-100 text-amber-700",
  inactive: "bg-stone-100 text-stone-500",
  revoked:  "bg-red-100 text-red-600",
}

export default function JoinCoachPage() {
  const router = useRouter()
  const [playerId,    setPlayerId]    = useState<string | null>(null)
  const [playerName,  setPlayerName]  = useState<string | null>(null)
  const [links,       setLinks]       = useState<CoachLink[]>([])
  const [code,        setCode]        = useState("")
  const [searching,   setSearching]   = useState(false)
  const [found,       setFound]       = useState<CoachResult | null>(null)
  const [searchErr,   setSearchErr]   = useState<string | null>(null)
  const [joining,     setJoining]     = useState(false)
  const [joinMsg,     setJoinMsg]     = useState<{msg:string; ok:boolean} | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      const [playerRes, profileRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("players") as any)
          .select("id, full_name").eq("profile_id", session.user.id).eq("is_active", true).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("profiles") as any)
          .select("full_name").eq("id", session.user.id).single(),
      ])

      const pl = playerRes.data
      if (pl) {
        setPlayerId(pl.id)
        setPlayerName(pl.full_name ?? profileRes.data?.full_name ?? null)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: linkData } = await (supabase.from("coach_player_links") as any)
          .select("id, status, linked_via, created_at, coaches(id, profiles(full_name, avatar_url))")
          .eq("player_id", pl.id).neq("status", "revoked")
          .order("created_at", { ascending: false })
        setLinks(linkData ?? [])
      } else {
        setPlayerName(profileRes.data?.full_name ?? null)
      }
      setLoading(false)
    })
  }, [router])

  async function handleSearch() {
    if (!code.trim()) return
    setSearching(true); setSearchErr(null); setFound(null)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("coaches") as any)
      .select("id, invite_code, profiles(full_name)")
      .ilike("invite_code", code.trim())
      .maybeSingle()
    if (error || !data) {
      setSearchErr("No coach found with that code. Check the code and try again.")
    } else {
      setFound(data)
    }
    setSearching(false)
  }

  async function handleJoin() {
    if (!playerId || !found) return
    setJoining(true); setJoinMsg(null)
    const supabase = createClient()
    // Check already linked
    const alreadyLinked = links.some(l => {
      return false // will handle via DB constraint
    })
    void alreadyLinked

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("coach_player_links") as any)
      .insert({
        player_id:  playerId,
        coach_id:   found.id,
        status:     "pending",
        linked_via: "invite_code",
      })

    if (error) {
      if (error.code === "23505") {
        setJoinMsg({ msg: "You are already linked to this coach.", ok: false })
      } else {
        setJoinMsg({ msg: error.message ?? "Could not send request.", ok: false })
      }
    } else {
      setJoinMsg({ msg: `Request sent to ${found.profiles?.full_name ?? "coach"}! They will confirm shortly.`, ok: true })
      setFound(null); setCode("")
      // Refresh links
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newLinks } = await (supabase.from("coach_player_links") as any)
        .select("id, status, linked_via, created_at, coaches(id, profiles(full_name, avatar_url))")
        .eq("player_id", playerId).neq("status", "revoked")
        .order("created_at", { ascending: false })
      setLinks(newLinks ?? [])
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
                        Linked via {l.linked_via ?? "direct"} · {new Date(l.created_at).toLocaleDateString("en-KE", { day:"numeric", month:"short", year:"numeric" })}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${LINK_STATUS[l.status] ?? "bg-stone-100 text-stone-500"}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Join by code */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
              <h2 className="font-bold text-stone-800 mb-1">Join a Coach</h2>
              <p className="text-xs text-stone-400 mb-3">Ask your coach for their invite code, then enter it below.</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") handleSearch() }}
                  placeholder="COACH-XXXX"
                  className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-green-700 uppercase"
                  maxLength={20}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !code.trim()}
                  className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors"
                >
                  {searching ? "…" : "Search"}
                </button>
              </div>

              {searchErr && <p className="text-xs text-red-600 mt-2">{searchErr}</p>}

              {/* Found coach */}
              {found && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">
                    👨‍🏫
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-800">{found.profiles?.full_name ?? "Coach"}</p>
                    <p className="text-xs text-emerald-600">Code: {found.invite_code}</p>
                  </div>
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    {joining ? "…" : "Request to Join"}
                  </button>
                </div>
              )}

              {joinMsg && (
                <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-medium ${joinMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {joinMsg.msg}
                </div>
              )}
            </div>

            {/* Empty state */}
            {links.length === 0 && !found && (
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
