"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import ChessBoard              from "@/components/chess/ChessBoard"
import type { ThemeId, PieceSetId } from "@/components/chess/themes"

type Node = {
  id:               string
  title:            string
  node_type:        string
  position_order:   number
  xp_reward:        number
  gold_reward:      number
  is_locked:        boolean
  unlock_level?:    number | null
  difficulty_rating?: number | null
  fen_position?:    string | null
  solution_moves?:  string[] | null
  boss_hp?:         number | null
}

type Completion = { quest_node_id: string; status: string; xp_earned: number; gold_earned: number }

type Campaign = {
  id:            string
  title:         string
  cover_emoji?:  string | null
  description?:  string | null
  theme?:        string | null
  difficulty_from?: number | null
  difficulty_to?:   number | null
}

type Assignment = {
  id:          string
  campaign_id: string
  expires_at:  string | null
  quest_campaigns: Campaign | null
  nodes:       Node[]
  completions: Completion[]
}

const NODE_ICON: Record<string, string> = {
  quest:       "⚔️",
  boss:        "💀",
  boss_return: "👹",
  checkpoint:  "🏕️",
  treasure:    "💰",
  story:       "📜",
}

// ── Boss HP bar ───────────────────────────────────────────────────────────────
function BossHpBar({ current, max }: { current: number; max: number }) {
  const pct  = Math.max(0, Math.round((current / max) * 100))
  const color = pct > 60 ? "#ef4444" : pct > 30 ? "#f97316" : "#fbbf24"
  return (
    <div className="px-4 pt-2 pb-1" style={{ background: "rgba(127,29,29,0.08)" }}>
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 10, fontWeight: 700, color: "#b91c1c", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          💀 Boss HP
        </span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#dc2626" }}>{current}/{max}</span>
      </div>
      <div style={{ height: 6, background: "#fee2e2", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99,
          transition: "width 0.5s", boxShadow: `0 0 6px ${color}88` }} />
      </div>
    </div>
  )
}

const CHESS_EMOJIS = ["👏","🔥","⚡","💪","🎯","✨","🏆","👑","🗡️","🛡️"]

function EmojiReactions({ onSend }: { onSend: (e: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", padding: "8px 0 4px" }}>
      {CHESS_EMOJIS.map(e => (
        <button key={e} type="button" onClick={() => onSend(e)}
          style={{
            fontSize: 20, background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
            padding: "4px 8px", cursor: "pointer", transition: "transform 0.1s",
          }}
          onMouseDown={el => (el.currentTarget.style.transform = "scale(1.3)")}
          onMouseUp={el  => (el.currentTarget.style.transform = "scale(1)")}
        >
          {e}
        </button>
      ))}
    </div>
  )
}

type FloatingEmoji = { id: number; emoji: string; x: number }

// ── Puzzle modal ──────────────────────────────────────────────────────────────
function PuzzleModal({ node, playerId, themeId, pieceSetId, onClose }: {
  node:       Node
  playerId:   string
  themeId:    ThemeId
  pieceSetId: PieceSetId
  onClose:    (completed: boolean) => void
}) {
  const [result,  setResult]  = useState<"success" | null>(null)
  const [bossHp,  setBossHp]  = useState(node.boss_hp ?? 100)
  const [floats,  setFloats]  = useState<FloatingEmoji[]>([])
  const floatId = useRef(0)
  const isBoss = node.node_type === "boss" || node.node_type === "boss_return"
  const maxHp  = node.boss_hp ?? 100
  const movesLen = node.solution_moves?.length ?? 1

  function sendEmoji(emoji: string) {
    const id = floatId.current++
    const x  = 20 + Math.random() * 60
    setFloats(f => [...f, { id, emoji, x }])
    setTimeout(() => setFloats(f => f.filter(e => e.id !== id)), 1800)
  }

  async function saveCompletion() {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (supabase.from("quest_completions") as any)
      .select("id").eq("player_id", playerId).eq("quest_node_id", node.id).maybeSingle()
    if (!existing.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("quest_completions") as any).insert({
        player_id: playerId, quest_node_id: node.id,
        status: "completed", attempts: 1, hints_used: 0,
        xp_earned: node.xp_reward, gold_earned: node.gold_reward,
        started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      })

      // Award XP and gold via RPC (handles level-up and gold_transactions log)
      await supabase.rpc("award_xp_gold", {
        p_player_id:   playerId,
        p_xp:          node.xp_reward,
        p_gold:        node.gold_reward,
        p_event_type:  "quest_complete",
        p_description: `Quest node: ${node.title}`,
      })

      // Schedule SR boss return for boss nodes
      if (isBoss && node.node_type !== "boss_return") {
        const motif = node.solution_moves ? "boss_encounter" : "boss_general"
        // Check if SR entry already exists for this motif
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingSr } = await (supabase.from("sr_queue") as any)
          .select("id").eq("player_id", playerId).eq("source_node_id", node.id).maybeSingle()
        if (!existingSr) {
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("sr_queue") as any).insert({
            player_id:     playerId,
            motif_tag:     motif,
            source_node_id: node.id,
            ease_factor:   2.5,
            interval_days: 1,
            repetitions:   0,
            due_date:      tomorrow.toISOString().slice(0, 10),
            is_active:     true,
          })
        }
      }
    }
  }

  async function handleSolve() {
    if (isBoss) {
      const dmg   = Math.max(10, Math.round(maxHp / Math.max(1, movesLen)))
      const newHp = Math.max(0, bossHp - dmg)
      setBossHp(newHp)
      if (newHp > 0) return
    }
    setResult("success")
    await saveCompletion()
    setTimeout(() => onClose(true), 1200)
  }

  async function markComplete() {
    setResult("success")
    await saveCompletion()
    setTimeout(() => onClose(true), 1200)
  }

  const headerBg = isBoss ? "#450a0a" : "#14532d"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={() => onClose(false)}>
      <div style={{ background: "#121829", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.6)", width: "100%", maxWidth: 384, overflow: "hidden", position: "relative" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background: headerBg }} className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">{node.title}</p>
            <p className="text-xs capitalize" style={{ color: isBoss ? "#fca5a5" : "#86efac" }}>
              {node.node_type.replace("_"," ")} · +{node.xp_reward} XP · +{node.gold_reward}🪙
            </p>
          </div>
          <button onClick={() => onClose(false)}
            className="text-xl leading-none"
            style={{ color: isBoss ? "#fca5a5" : "#86efac" }}>×</button>
        </div>

        {isBoss && !result && <BossHpBar current={bossHp} max={maxHp} />}

        <style>{`
          @keyframes floatEmoji {
            0%   { opacity: 1; transform: translateY(0) scale(1); }
            80%  { opacity: 0.8; transform: translateY(-80px) scale(1.2); }
            100% { opacity: 0; transform: translateY(-110px) scale(0.9); }
          }
        `}</style>

        {/* Floating emoji layer */}
        {floats.map(f => (
          <div key={f.id} style={{
            position: "absolute",
            left:     `${f.x}%`,
            bottom:   48,
            fontSize: 28,
            pointerEvents: "none",
            animation: "floatEmoji 1.8s ease-out forwards",
            zIndex: 60,
          }}>
            {f.emoji}
          </div>
        ))}

        <div className="p-4 flex flex-col items-center" style={{ position: "relative" }}>
          {result ? (
            <div className="rounded-xl py-8 text-center w-full"
              style={{ background: isBoss ? "rgba(248,113,113,0.08)" : "rgba(16,185,129,0.08)" }}>
              <span className="text-5xl">{isBoss ? "⚔️" : "🎉"}</span>
              <p className="mt-3 font-bold" style={{ color: isBoss ? "#F87171" : "#10B981" }}>
                {isBoss ? "Boss Defeated!" : "Brilliant!"}
              </p>
              <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>+{node.xp_reward} XP earned</p>
            </div>
          ) : node.fen_position && node.solution_moves ? (
            <>
              <ChessBoard
                fen={node.fen_position}
                solutionMoves={node.solution_moves}
                themeId={themeId} pieceSetId={pieceSetId}
                flipped={node.fen_position.split(" ")[1] === "b"}
                onSolve={handleSolve}
                onCaptureSuccess={() => {}} onNodeCleared={() => {}}
              />
              <EmojiReactions onSend={sendEmoji} />
            </>
          ) : (
            <div className="py-10 text-center w-full">
              <span className="text-4xl">{NODE_ICON[node.node_type] ?? "⚔️"}</span>
              <p className="mt-3 text-stone-700 font-medium">{node.title}</p>
              <p className="text-sm text-stone-400 mt-1">
                Complete this {node.node_type} to earn {node.xp_reward} XP and {node.gold_reward} 🪙
              </p>
              <button onClick={markComplete}
                className="mt-4 px-5 py-2 text-white text-sm font-bold rounded-xl"
                style={{ background: "#166534" }}>
                Mark Complete
              </button>
              <EmojiReactions onSend={sendEmoji} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Trail node sizes ──────────────────────────────────────────────────────────
const NODE_SIZE: Record<string, number> = {
  boss: 56, boss_return: 52, checkpoint: 46, treasure: 46,
  quest: 44, story: 40,
}

// ── Trail map for one campaign ────────────────────────────────────────────────
function CampaignTrail({ assignment, level, compSet, onNodeClick }: {
  assignment: Assignment
  level:      number
  compSet:    Set<string>
  onNodeClick: (n: Node) => void
}) {
  const { nodes, quest_campaigns: c, expires_at } = assignment
  const completed  = nodes.filter(n => compSet.has(n.id)).length
  const total      = nodes.length
  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0

  // Trail layout: alternate left/center/right columns
  const COLS = ["left", "center", "right"] as const
  type Col = typeof COLS[number]
  const colLeft: Record<Col, number> = { left: 12, center: 80, right: 148 }
  const ROW_H   = 80
  const canvasW  = 220
  const canvasH  = Math.max(160, nodes.length * ROW_H + 40)

  // Build path points
  const pts = nodes.map((_, i) => {
    const col = COLS[i % 3]
    const x   = colLeft[col] + 24 // centre of node circle
    const y   = 30 + i * ROW_H
    return { x, y }
  })

  // Build SVG path string
  const pathD = pts.length < 2 ? "" : pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = pts[i - 1]
    const cx   = (prev.x + p.x) / 2
    return acc + ` Q ${cx} ${prev.y} ${p.x} ${p.y}`
  }, "")

  return (
    <div className="cc-card" style={{ overflow: "hidden", marginBottom: 16 }}>
      {/* Campaign header */}
      <div style={{ background: "#1B5E35", padding: "14px 16px" }}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{c?.cover_emoji ?? "⚔️"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate">{c?.title ?? "Campaign"}</p>
            {c?.description && <p className="text-green-300 text-xs mt-0.5 line-clamp-1">{c.description}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-amber-400 text-xs font-bold">{completed}/{total}</p>
            <p className="text-green-400 text-[10px]">nodes</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-green-950 rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Trail canvas */}
      <div className="relative overflow-x-auto">
        <div style={{ position: "relative", width: canvasW, minHeight: canvasH, margin: "0 auto" }}>
          {/* SVG path */}
          <svg
            width={canvasW} height={canvasH}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {pathD && (
              <path d={pathD} fill="none"
                stroke="rgba(27,94,53,0.2)" strokeWidth={3} strokeDasharray="6 4" />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map((n, i) => {
            const col  = COLS[i % 3]
            const x    = colLeft[col]
            const y    = 30 + i * ROW_H - 24
            const done = compSet.has(n.id)
            const locked = n.is_locked && level < (n.unlock_level ?? 0)
            const isCurrent = !done && !locked && i === nodes.findIndex(nd => !compSet.has(nd.id) && !(nd.is_locked && level < (nd.unlock_level ?? 0)))
            const isBoss   = n.node_type === "boss" || n.node_type === "boss_return"
            const size     = NODE_SIZE[n.node_type] ?? 44

            let bg    = "#e2e8f0"  // locked
            let border = "#cbd5e1"
            let shadow = "none"
            if (done)      { bg = "#dcfce7"; border = "#4ade80" }
            else if (isBoss && !locked) { bg = "#fee2e2"; border = "#f87171"; shadow = "0 0 12px #f8717188" }
            else if (isCurrent) { bg = "#fef3c7"; border = "#fbbf24"; shadow = "0 0 12px #fbbf2488" }
            else if (!locked)   { bg = "#f0fdf4"; border = "#86efac" }

            // Label position: right for left/center col, left for right col
            const labelRight = col === "right"

            return (
              <div key={n.id} style={{ position: "absolute", left: x, top: y }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: size }}>
                  <button
                    onClick={() => !locked && onNodeClick(n)}
                    disabled={locked}
                    style={{
                      width: size, height: size, borderRadius: "50%",
                      background: bg, border: `3px solid ${border}`,
                      boxShadow: isCurrent ? shadow : isBoss ? shadow : undefined,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: isBoss ? 22 : 18,
                      cursor: locked ? "not-allowed" : "pointer",
                      transition: "transform 0.15s",
                      transform: isCurrent ? "scale(1.08)" : "scale(1)",
                    }}
                  >
                    {done ? "✓" : locked ? "🔒" : NODE_ICON[n.node_type] ?? "❓"}
                  </button>
                  {/* Label */}
                  <div style={{
                    position: "absolute",
                    [labelRight ? "right" : "left"]: size + 4,
                    top: size / 2 - 18,
                    width: 88, textAlign: labelRight ? "right" : "left",
                  }}>
                    <p style={{
                      fontSize: 11, fontWeight: 600, lineHeight: 1.2,
                      color: done ? "#9CA3AF" : locked ? "#D1D5DB" : isCurrent ? "#B45309" : "#374151",
                      textDecoration: done ? "line-through" : undefined,
                    }}>
                      {n.title}
                    </p>
                    <p style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>
                      {n.xp_reward > 0 ? `+${n.xp_reward}XP` : ""}
                      {n.gold_reward > 0 ? ` +${n.gold_reward}🪙` : ""}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {expires_at && (
        <div style={{ padding: "8px 16px", background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, color: "var(--text-3)" }}>
            Expires {new Date(expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuestsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [level,       setLevel]       = useState(1)
  const [gold,        setGold]        = useState(0)
  const [streak,      setStreak]      = useState(0)
  const [srDue,       setSrDue]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [playerId,    setPlayerId]    = useState<string | null>(null)
  const [activeNode,  setActiveNode]  = useState<Node | null>(null)
  const [themeId,     setThemeId]     = useState<ThemeId>("classic")
  const [pieceSetId,  setPieceSetId]  = useState<PieceSetId>("standard")
  // boardFlipped removed — puzzles auto-flip based on FEN turn
  const [allCompSet,  setAllCompSet]  = useState<Set<string>>(new Set())

  async function loadData(supabase: ReturnType<typeof createClient>, pid: string) {
    const [gpRes, assignRes, srRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("player_game_profiles") as any)
        .select("current_level, gold_balance, streak_current, board_theme, piece_set, board_flipped")
        .eq("player_id", pid).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("quest_assignments") as any)
        .select("id, campaign_id, expires_at, quest_campaigns(id, title, cover_emoji, description, theme, difficulty_from, difficulty_to)")
        .eq("player_id", pid).eq("status", "active"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("sr_queue") as any)
        .select("id").eq("player_id", pid).eq("is_active", true)
        .lte("due_date", new Date().toISOString().slice(0, 10)),
    ])

    setLevel(gpRes.data?.current_level ?? 1)
    setGold(gpRes.data?.gold_balance ?? 0)
    setStreak(gpRes.data?.streak_current ?? 0)
    setSrDue((srRes.data ?? []).length)
    if (gpRes.data?.board_theme) setThemeId(gpRes.data.board_theme as ThemeId)
    if (gpRes.data?.piece_set)   setPieceSetId(gpRes.data.piece_set as PieceSetId)
    // board_flipped preference removed — puzzles auto-flip based on FEN turn

    const raw = assignRes.data ?? []
    const enriched: Assignment[] = await Promise.all(raw.map(async (a: { id: string; campaign_id: string; expires_at: string | null; quest_campaigns: Campaign | null }) => {
      const [nodesRes, compRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_nodes") as any)
          .select("id, title, node_type, position_order, xp_reward, gold_reward, is_locked, unlock_level, difficulty_rating, fen_position, solution_moves, boss_hp")
          .eq("campaign_id", a.campaign_id).order("position_order"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_completions") as any)
          .select("quest_node_id, status, xp_earned, gold_earned").eq("player_id", pid),
      ])
      return { ...a, nodes: nodesRes.data ?? [], completions: compRes.data ?? [] }
    }))

    setAssignments(enriched)
    const cs = new Set<string>()
    enriched.forEach(a => a.completions.filter(c => c.status === "completed").forEach(c => cs.add(c.quest_node_id)))
    setAllCompSet(cs)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) { setLoading(false); return }
      setPlayerId(player.id)
      await loadData(supabase, player.id)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function handleModalClose(completed: boolean) {
    setActiveNode(null)
    if (completed && playerId) {
      const supabase = createClient()
      await loadData(supabase, playerId)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 72 }}>
      {activeNode && playerId && (
        <PuzzleModal
          node={activeNode} playerId={playerId}
          themeId={themeId} pieceSetId={pieceSetId}
          onClose={handleModalClose}
        />
      )}

      {/* Header */}
      <header style={{ padding:"16px 18px 12px", background:"#1B5E35", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontFamily:"serif", fontSize:20, color:"#fff" }}>⚔</span>
          <span style={{ fontFamily:"var(--font-display)", fontSize:22, color:"#fff", letterSpacing:"0.04em" }}>QUEST MAP</span>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <a href="/puzzle-rush" style={{ fontFamily:"var(--font-display)", fontSize:10, letterSpacing:"0.08em", padding:"5px 12px", borderRadius:99, background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)", color:"#fff", textDecoration:"none" }}>⚡ RUSH</a>
          <a href="/duel" style={{ fontFamily:"var(--font-display)", fontSize:10, letterSpacing:"0.08em", padding:"5px 12px", borderRadius:99, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"#fff", textDecoration:"none" }}>🤺 DUEL</a>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "#10b981", borderTopColor: "transparent" }} />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "♚", label: "LEVEL",  value: String(level),  color: "var(--gold)" },
                { icon: "🪙", label: "GOLD",   value: String(gold),   color: "var(--gold)" },
                { icon: "🔥", label: "STREAK", value: `${streak}D`,   color: "var(--orange)" },
              ].map((s, i) => (
                <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:18, padding:"14px 10px", textAlign:"center" }}>
                  <span style={{ fontFamily:"serif", fontSize:20, color:s.color }}>{s.icon}</span>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:22, color:s.color, marginTop:6, lineHeight:1 }}>{s.value}</p>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:8, color:"var(--text-3)", letterSpacing:"0.12em", marginTop:4 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Boss returns due */}
            {srDue > 0 && (
              <a href="/encounters" style={{ textDecoration: "none" }}>
                <div style={{ background: "linear-gradient(135deg, #450a0a, #7f1d1d)", borderRadius: 16 }}
                  className="p-4 flex items-center gap-3">
                  <span className="text-3xl">👹</span>
                  <div>
                    <p className="text-white font-bold text-sm">Boss Returns Due!</p>
                    <p className="text-red-200 text-xs mt-0.5">{srDue} encounter{srDue > 1 ? "s" : ""} ready</p>
                  </div>
                  <div className="ml-auto shrink-0 flex items-center gap-2">
                    <span className="text-2xl font-black text-red-300">{srDue}</span>
                    <span className="text-red-300 text-sm">→</span>
                  </div>
                </div>
              </a>
            )}

            {/* Campaign trails */}
            {assignments.length === 0 ? (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20, padding:48, textAlign:"center" }}>
                <span style={{ fontFamily:"serif", fontSize:52, color:"var(--green-mid)" }}>♜</span>
                <p style={{ fontFamily:"var(--font-display)", color:"var(--text-2)", fontSize:18, letterSpacing:"0.1em", marginTop:14 }}>NO ACTIVE QUESTS</p>
                <p style={{ fontSize:12, color:"var(--text-3)", marginTop:8 }}>Your coach will assign campaigns here.</p>
              </div>
            ) : (
              assignments.map(a => (
                <CampaignTrail
                  key={a.id}
                  assignment={a}
                  level={level}
                  compSet={allCompSet}
                  onNodeClick={n => setActiveNode(n)}
                />
              ))
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
