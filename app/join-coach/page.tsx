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
    <div style={{ minHeight: "100vh", background: "#070B17", paddingBottom: 80 }}>
      <header style={{ padding: "18px 16px 14px", background: "linear-gradient(180deg, #0D1224 0%, transparent 100%)", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 40 }}>
        <span style={{ fontSize: 22 }}>👨‍🏫</span>
        <span style={{ fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 19, color: "#F1F5F9", letterSpacing: "0.02em" }}>Join a Coach</span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !playerId ? (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, padding: 24, textAlign: "center" }}>
            <span className="text-3xl">⚠️</span>
            <p className="mt-3 text-amber-800 font-medium">No player profile found</p>
            <p className="text-sm text-amber-700 mt-1">Ask your club or school admin to create your player profile first.</p>
          </div>
        ) : (
          <>
            {/* Current coaches */}
            {links.length > 0 && (
              <div style={{ background: "#0D1224", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <p style={{ fontFamily: "var(--cc-font-display)", fontWeight: 700, fontSize: 13, color: "#F1F5F9" }}>My Coaches</p>
                </div>
                {links.map((l, i) => (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < links.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      👨‍🏫
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.coaches?.profiles?.full_name ?? "Coach"}
                      </p>
                      <p style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        Via {l.linked_via ?? "direct"} · {new Date(l.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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
            <div style={{ background: "#0D1224", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontFamily: "var(--cc-font-display)", fontWeight: 700, color: "#F1F5F9", fontSize: 15 }}>Enter Invite Code</p>
                <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Ask your coach for their invite code — it looks like GUILD-KNIGHT-402.</p>
              </div>

              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") handleJoin() }}
                placeholder="GUILD-KNIGHT-402"
                className="cc-input"
                style={{ fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}
                maxLength={24}
                disabled={joining}
              />

              <button
                onClick={handleJoin}
                disabled={joining || !code.trim()}
                style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #0D8A5C, #10B981)", border: "none", borderRadius: 14, fontFamily: "var(--cc-font-display)", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", opacity: (joining || !code.trim()) ? 0.4 : 1, boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}
              >
                {joining ? "Connecting…" : "Join Coach"}
              </button>

              {msg && (
                <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: msg.ok ? "rgba(16,185,129,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${msg.ok ? "rgba(16,185,129,0.2)" : "rgba(248,113,113,0.2)"}`, color: msg.ok ? "#10B981" : "#F87171" }}>
                  {msg.text}
                </div>
              )}
            </div>

            {links.length === 0 && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, textAlign: "center" }}>
                <span style={{ fontSize: 40 }}>👨‍🏫</span>
                <p style={{ fontFamily: "var(--cc-font-display)", color: "#475569", fontWeight: 600, marginTop: 12 }}>No coaches yet</p>
                <p style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>Enter your coach's invite code above to connect.</p>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
