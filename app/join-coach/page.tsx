"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { UserRound, AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

type CoachLink = { id: string; status: string; linked_via: string | null; created_at: string; coaches?: { profiles?: { full_name?: string | null } | null } | null }

const LINK_STATUS: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  pending: "bg-amber-500/10 text-amber-700",
  inactive: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive",
}

export default function JoinCoachPage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [links, setLinks] = useState<CoachLink[]>([])
  const [code, setCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

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
      .eq("player_id", pid).neq("status", "revoked").order("created_at", { ascending: false })
    setLinks(data ?? [])
  }

  async function handleJoin() {
    if (!code.trim() || !playerId) return
    setJoining(true)
    setMsg(null)
    const supabase = createClient()
    const { data: result, error } = await supabase.rpc("redeem_invite_code", { p_code: code.trim().toUpperCase(), p_player_id: playerId })

    if (error) {
      setMsg({ ok: false, text: error.message ?? "Something went wrong. Please try again." })
      setJoining(false)
      return
    }

    const res = result as { ok: boolean; reason?: string; status?: string; needs_parent_approval?: boolean }
    if (!res.ok) {
      const messages: Record<string, string> = {
        invalid_code: "This code doesn't exist or has been deactivated. Check the code and try again.",
        expired: "This invite code has expired. Ask your coach to generate a new one.",
        max_uses_reached: "This invite code has reached its maximum uses. Ask your coach for a new code.",
        already_linked: "You are already linked to this coach.",
        player_not_found: "Your player profile could not be found. Contact your admin.",
      }
      setMsg({ ok: false, text: messages[res.reason ?? ""] ?? "Could not redeem code. Please try again." })
    } else {
      const needsApproval = res.needs_parent_approval ?? res.status === "pending"
      setMsg({ ok: true, text: needsApproval ? "Request sent! Your parent/guardian needs to approve the connection." : "You are now connected to your coach!" })
      setCode("")
      await refreshLinks(supabase, playerId)
    }
    setJoining(false)
  }

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">Connect with a coach</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Join a coach</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : !playerId ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <AlertTriangle size={26} className="text-amber-600" />
          <p className="font-semibold text-foreground">No player profile found</p>
          <p className="text-[13px] text-muted-foreground">Ask your club or school admin to create your player profile first.</p>
        </Card>
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          {links.length > 0 && (
            <Card className="divide-y divide-border overflow-hidden p-0">
              <div className="p-3.5"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">My coaches</p></div>
              {links.map(l => (
                <div key={l.id} className="flex items-center gap-3 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green-mid font-serif text-[13px] font-bold text-white">
                    {(l.coaches?.profiles?.full_name ?? "C").split(" ").map(n => n[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{l.coaches?.profiles?.full_name ?? "Coach"}</p>
                    <p className="text-[11px] text-muted-foreground">Via {l.linked_via ?? "direct"} · {new Date(l.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize " + (LINK_STATUS[l.status] ?? LINK_STATUS.inactive)}>{l.status}</span>
                </div>
              ))}
            </Card>
          )}

          <Card className="flex flex-col gap-3 p-4">
            <div>
              <p className="text-[14px] font-bold text-foreground">Enter invite code</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Ask your coach for their invite code — it looks like CHESS-COACH-402.</p>
            </div>
            <Input
              value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") handleJoin() }}
              placeholder="CHESS-COACH-402" maxLength={24} disabled={joining}
              className="font-mono tracking-wider uppercase"
            />
            <Button onClick={handleJoin} disabled={joining || !code.trim()} className="w-full">
              {joining ? "Connecting…" : "Join coach"}
            </Button>
            {msg && (
              <div className={"rounded-xl border p-3 text-[13px] font-semibold " + (msg.ok ? "border-primary/20 bg-primary/5 text-primary" : "border-destructive/20 bg-destructive/5 text-destructive")}>
                {msg.text}
              </div>
            )}
          </Card>

          {links.length === 0 && (
            <EmptyState icon={UserRound} title="No coaches yet" detail="Enter your coach's invite code above to connect." />
          )}
        </div>
      )}
    </AppShell>
  )
}
