"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter }    from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { BottomNav }    from "@/components/BottomNav"
import ChessBoard       from "@/components/chess/ChessBoard"
import type { ThemeId, PieceSetId } from "@/components/chess/themes"

// ── Types ─────────────────────────────────────────────────────────────────────
type QuestNode = {
  id:             string
  title:          string
  node_type:      string
  fen_position?:  string | null
  solution_moves?: string[] | null
  xp_reward:      number
  gold_reward:    number
  boss_hp?:       number | null
  difficulty_rating?: number | null
  puzzle_motif?:  string | null
}

type SrEntry = {
  id:            string
  motif_tag:     string
  ease_factor:   number
  interval_days: number
  repetitions:   number
  due_date:      string
  last_reviewed: string | null
  difficulty_score: number | null
  source_node_id: string | null
  node:          QuestNode | null
}

// ── SM-2 scheduling ───────────────────────────────────────────────────────────
function sm2Next(
  ease: number, interval: number, reps: number, passed: boolean
): { ease: number; interval: number; reps: number; dueDate: string } {
  let newEase     = ease
  let newInterval = interval
  let newReps     = reps

  if (passed) {
    newEase     = Math.min(3.0, ease + 0.1)
    newReps     = reps + 1
    newInterval = Math.min(30, reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * newEase))
  } else {
    newEase     = Math.max(1.3, ease - 0.2)
    newReps     = 0
    newInterval = 1
  }

  const due = new Date()
  due.setDate(due.getDate() + newInterval)
  const dueDate = due.toISOString().slice(0, 10)

  return { ease: newEase, interval: newInterval, reps: newReps, dueDate }
}

// ── Difficulty bar ────────────────────────────────────────────────────────────
function DiffBar({ rating }: { rating: number | null }) {
  const r   = rating ?? 1000
  const pct = Math.min(100, Math.round(((r - 500) / 2000) * 100))
  const color = pct < 33 ? "#22c55e" : pct < 66 ? "#f59e0b" : "#ef4444"
  return (
    <div style={{ height: 4, background: "var(--border)", borderRadius: 99, marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
    </div>
  )
}

// ── Boss encounter modal ──────────────────────────────────────────────────────
function EncounterModal({ entry, themeId, pieceSetId, flipped, playerId, onDone }: {
  entry:      SrEntry
  themeId:    ThemeId
  pieceSetId: PieceSetId
  flipped:    boolean
  playerId:   string
  onDone:     (passed: boolean) => void
}) {
  const [phase,  setPhase]  = useState<"fight" | "result">("fight")
  const [passed, setPassed] = useState(false)
  const [bossHp, setBossHp] = useState(entry.node?.boss_hp ?? 100)
  const maxHp  = entry.node?.boss_hp ?? 100
  const node   = entry.node
  const movesLen = node?.solution_moves?.length ?? 1

  async function handleSolve() {
    const dmg   = Math.max(10, Math.round(maxHp / Math.max(1, movesLen)))
    const newHp = Math.max(0, bossHp - dmg)
    setBossHp(newHp)
    if (newHp > 0) return

    // Boss defeated
    const { ease, interval, reps, dueDate } = sm2Next(
      entry.ease_factor, entry.interval_days, entry.repetitions, true
    )
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("sr_queue") as any)
      .update({
        ease_factor:   ease,
        interval_days: interval,
        repetitions:   reps,
        due_date:      dueDate,
        last_reviewed: new Date().toISOString().slice(0, 10),
        updated_at:    new Date().toISOString(),
      })
      .eq("id", entry.id)

    // XP + gold reward (half of original) via RPC
    if (node) {
      await supabase.rpc("award_xp_gold", {
        p_player_id:   playerId,
        p_xp:          Math.floor((node.xp_reward ?? 20) / 2),
        p_gold:        Math.floor((node.gold_reward ?? 5) / 2),
        p_event_type:  "sr_encounter",
        p_description: `SR Boss Return: ${entry.motif_tag.replace(/_/g, " ")}`,
      })
    }

    setPassed(true)
    setPhase("result")
    setTimeout(() => onDone(true), 1500)
  }

  function handleFail() {
    // Schedule tomorrow
    sm2Next(entry.ease_factor, entry.interval_days, entry.repetitions, false)
    const supabase = createClient()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from("sr_queue") as any)
      .update({
        ease_factor:   Math.max(1.3, entry.ease_factor - 0.2),
        interval_days: 1,
        repetitions:   0,
        due_date:      tomorrow.toISOString().slice(0, 10),
        last_reviewed: new Date().toISOString().slice(0, 10),
        updated_at:    new Date().toISOString(),
      })
      .eq("id", entry.id)
      .then(() => {})

    setPassed(false)
    setPhase("result")
    setTimeout(() => onDone(false), 1500)
  }

  const hpPct   = Math.round((bossHp / maxHp) * 100)
  const hpColor = hpPct > 60 ? "#ef4444" : hpPct > 30 ? "#f97316" : "#fbbf24"
  const nextSchedule = sm2Next(entry.ease_factor, entry.interval_days, entry.repetitions, true)

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 16px",
    }}
      onClick={() => onDone(false)}>
      <div style={{
        background: "#1c1917", borderRadius: 20, width: "100%", maxWidth: 380,
        overflow: "hidden", boxShadow: "0 20px 60px rgba(239,68,68,0.3)",
        border: "1px solid rgba(239,68,68,0.25)",
      }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #450a0a, #7f1d1d)", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ color: "#fca5a5", fontWeight: 700, fontSize: 15 }}>
                👹 {node?.title ?? "Boss Return"}
              </p>
              <p style={{ color: "rgba(252,165,165,0.7)", fontSize: 11, marginTop: 2 }}>
                {entry.motif_tag.replace(/_/g, " ")} · Rep #{entry.repetitions + 1} · +{Math.floor((node?.xp_reward ?? 20) / 2)} XP
              </p>
            </div>
            <button onClick={() => onDone(false)}
              style={{ color: "#fca5a5", fontSize: 22, background: "none", border: "none", cursor: "pointer" }}>
              ×
            </button>
          </div>

          {/* HP bar */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#fca5a5", fontWeight: 700, textTransform: "uppercase" }}>💀 Boss HP</span>
              <span style={{ fontSize: 10, color: "#fca5a5", fontFamily: "monospace" }}>{bossHp}/{maxHp}</span>
            </div>
            <div style={{ height: 8, background: "rgba(0,0,0,0.4)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                width: `${hpPct}%`, height: "100%", background: hpColor,
                borderRadius: 99, transition: "width 0.5s",
                boxShadow: `0 0 8px ${hpColor}88`,
              }} />
            </div>
          </div>
        </div>

        {/* Board / result */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {phase === "result" ? (
            <div style={{
              width: "100%", padding: "32px 16px", textAlign: "center",
              background: passed ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              borderRadius: 16,
            }}>
              <div style={{ fontSize: 56 }}>{passed ? "⚔️" : "💀"}</div>
              <p style={{
                fontWeight: 800, fontSize: 20, marginTop: 10,
                color: passed ? "#4ade80" : "#f87171",
              }}>
                {passed ? "Boss Defeated!" : "Retreating…"}
              </p>
              {passed && (
                <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                  Next review in {nextSchedule.interval} day{nextSchedule.interval === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ) : node?.fen_position && node.solution_moves ? (
            <>
              <ChessBoard
                fen={node.fen_position}
                solutionMoves={node.solution_moves}
                themeId={themeId}
                pieceSetId={pieceSetId}
                flipped={flipped}
                onSolve={handleSolve}
                onCaptureSuccess={() => {}}
                onNodeCleared={() => {}}
              />
              <button onClick={handleFail}
                style={{
                  marginTop: 12, padding: "8px 20px", borderRadius: 10,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94a3b8", fontSize: 12, cursor: "pointer",
                }}>
                Skip (mark for tomorrow)
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ color: "#94a3b8" }}>No puzzle available for this encounter.</p>
              <button onClick={() => onDone(false)}
                style={{ marginTop: 12, padding: "8px 20px", borderRadius: 10,
                  background: "#166534", color: "#fff", border: "none", cursor: "pointer" }}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EncountersPage() {
  const router = useRouter()
  const [playerId,  setPlayerId]  = useState<string | null>(null)
  const [entries,   setEntries]   = useState<SrEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [active,    setActive]    = useState<SrEntry | null>(null)
  const [themeId,   setThemeId]   = useState<ThemeId>("classic")
  const [pieceSetId,setPieceSetId]= useState<PieceSetId>("standard")
  const [flipped,   setFlipped]   = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  const loadEntries = useCallback(async (supabase: ReturnType<typeof createClient>, pid: string) => {
    const today = new Date().toISOString().slice(0, 10)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: srData } = await (supabase.from("sr_queue") as any)
      .select("id, motif_tag, ease_factor, interval_days, repetitions, due_date, last_reviewed, difficulty_score, source_node_id")
      .eq("player_id", pid)
      .eq("is_active", true)
      .lte("due_date", today)
      .order("due_date")

    if (!srData || srData.length === 0) {
      setEntries([])
      return
    }

    // Fetch linked quest nodes
    const nodeIds = [...new Set((srData as SrEntry[])
      .map(e => e.source_node_id)
      .filter(Boolean))] as string[]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: nodeData } = nodeIds.length > 0
      ? await (supabase.from("quest_nodes") as any)
          .select("id, title, node_type, fen_position, solution_moves, xp_reward, gold_reward, boss_hp, difficulty_rating, puzzle_motif")
          .in("id", nodeIds)
      : { data: [] }

    const nodeMap = new Map<string, QuestNode>((nodeData ?? []).map((n: QuestNode) => [n.id, n]))

    const enriched: SrEntry[] = srData.map((e: SrEntry) => ({
      ...e,
      ease_factor:   Number(e.ease_factor),
      node: e.source_node_id ? (nodeMap.get(e.source_node_id) ?? null) : null,
    }))

    setEntries(enriched)
  }, [])

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
      const { data: gp } = await (supabase.from("player_game_profiles") as any)
        .select("board_theme, piece_set, board_flipped")
        .eq("player_id", pl.id).maybeSingle()

      if (gp?.board_theme) setThemeId(gp.board_theme as ThemeId)
      if (gp?.piece_set)   setPieceSetId(gp.piece_set as PieceSetId)
      if (typeof gp?.board_flipped === "boolean") setFlipped(gp.board_flipped)

      await loadEntries(supabase, pl.id)
      setLoading(false)
    })
  }, [router, loadEntries])

  async function handleDone(passed: boolean) {
    setActive(null)
    if (passed) setDoneCount(c => c + 1)
    if (playerId) {
      const supabase = createClient()
      await loadEntries(supabase, playerId)
    }
  }

  const totalDue      = entries.length + doneCount
  const remaining     = entries.length
  const completedPct  = totalDue > 0 ? Math.round((doneCount / totalDue) * 100) : 0

  // group overdue vs due-today
  const today = new Date().toISOString().slice(0, 10)
  const overdue    = entries.filter(e => e.due_date < today)
  const dueToday   = entries.filter(e => e.due_date === today)

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 72 }}>
      {active && playerId && (
        <EncounterModal
          entry={active}
          themeId={themeId}
          pieceSetId={pieceSetId}
          flipped={flipped}
          playerId={playerId}
          onDone={handleDone}
        />
      )}

      {/* Header */}
      <header style={{ background: "#1B5E35", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>👹</span>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#fff", letterSpacing: "0.04em" }}>BOSS RETURNS</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
              Spaced repetition training
            </p>
          </div>
        </div>
        <button onClick={() => router.back()}
          style={{ color: "rgba(252,165,165,0.5)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>
          ← Back
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-24">
            <div style={{ width: 32, height: 32, border: "4px solid #ef4444",
              borderTopColor: "transparent", borderRadius: "50%",
              animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            {/* Progress strip */}
            {totalDue > 0 && (
              <div style={{
                background: "var(--surface)", borderRadius: 16,
                border: "1px solid var(--border)", padding: "14px 16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "var(--text-2)", fontSize: 13, fontWeight: 600 }}>
                    Session Progress
                  </span>
                  <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>
                    {doneCount}/{totalDue}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    width: `${completedPct}%`, height: "100%",
                    background: "linear-gradient(90deg, #1B5E35, #2E7D50)",
                    borderRadius: 99, transition: "width 0.5s",
                  }} />
                </div>
                {remaining === 0 && doneCount > 0 && (
                  <p style={{ color: "var(--green)", fontSize: 12, marginTop: 8, fontWeight: 600, textAlign: "center" }}>
                    🎉 All encounters cleared! Come back tomorrow.
                  </p>
                )}
              </div>
            )}

            {entries.length === 0 ? (
              <div style={{
                background: "var(--surface)", borderRadius: 20,
                border: "1px solid var(--border)",
                padding: "48px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 56 }}>🏆</div>
                <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 18, marginTop: 12 }}>
                  {doneCount > 0 ? "All Done!" : "No Encounters Due"}
                </p>
                <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 6 }}>
                  {doneCount > 0
                    ? `You defeated ${doneCount} boss${doneCount > 1 ? "es" : ""}. Come back tomorrow!`
                    : "Your bosses are resting. Defeat new ones in Quest Map to unlock SR training."}
                </p>
                <button onClick={() => router.push("/quests")}
                  style={{
                    marginTop: 20, padding: "10px 24px", borderRadius: 12,
                    background: "#1B5E35",
                    color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
                  }}>
                  ⚔️ Go to Quest Map
                </button>
              </div>
            ) : (
              <>
                {/* Overdue section */}
                {overdue.length > 0 && (
                  <div>
                    <p style={{ color: "#f87171", fontSize: 11, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, paddingLeft: 4 }}>
                      ⚠️ Overdue ({overdue.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {overdue.map(e => <EncounterCard key={e.id} entry={e} onFight={() => setActive(e)} />)}
                    </div>
                  </div>
                )}

                {/* Due today section */}
                {dueToday.length > 0 && (
                  <div>
                    <p style={{ color: "var(--text-2)", fontSize: 11, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, paddingLeft: 4 }}>
                      Due Today ({dueToday.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {dueToday.map(e => <EncounterCard key={e.id} entry={e} onFight={() => setActive(e)} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ── Encounter card ────────────────────────────────────────────────────────────
function EncounterCard({ entry, onFight }: { entry: SrEntry; onFight: () => void }) {
  const node      = entry.node
  const motifLabel = entry.motif_tag.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  const isOverdue  = entry.due_date < new Date().toISOString().slice(0, 10)

  return (
    <div style={{
      background: "var(--surface)",
      borderRadius: 16,
      border: `1px solid ${isOverdue ? "rgba(220,38,38,0.25)" : "var(--border)"}`,
      overflow: "hidden",
      boxShadow: isOverdue ? "0 0 0 1px rgba(220,38,38,0.1)" : "var(--shadow-sm)",
    }}>
      <div style={{
        background: isOverdue ? "rgba(254,242,242,1)" : "var(--surface)",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: isOverdue ? "rgba(220,38,38,0.1)" : "var(--green-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, flexShrink: 0,
          border: `1px solid ${isOverdue ? "rgba(220,38,38,0.2)" : "var(--green-mid)"}`,
        }}>
          👹
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {node?.title ?? motifLabel}
          </p>
          <p style={{ color: "var(--text-2)", fontSize: 11, marginTop: 2 }}>
            {motifLabel} · Rep #{entry.repetitions}
            {entry.last_reviewed ? ` · Last: ${new Date(entry.last_reviewed).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
          </p>
          {node?.difficulty_rating && <DiffBar rating={node.difficulty_rating} />}
        </div>

        <button onClick={onFight}
          style={{
            padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: isOverdue ? "#DC2626" : "#1B5E35",
            color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0,
            boxShadow: isOverdue ? "0 2px 8px rgba(220,38,38,0.35)" : "none",
          }}>
          Fight →
        </button>
      </div>

      {/* Footer: XP + next interval estimate */}
      <div style={{
        padding: "8px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}>
        <span style={{ color: "var(--gold)", fontSize: 11, fontWeight: 600 }}>
          +{Math.floor((node?.xp_reward ?? 20) / 2)} XP on defeat
        </span>
        <span style={{ color: "var(--text-3)", fontSize: 10 }}>
          Interval: {entry.interval_days}d · Ease: {entry.ease_factor.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
