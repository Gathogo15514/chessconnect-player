"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

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

const NODE_COLOR: Record<string, string> = {
  quest:       "bg-blue-100 text-blue-700 border-blue-200",
  boss:        "bg-red-100 text-red-700 border-red-200",
  boss_return: "bg-orange-100 text-orange-700 border-orange-200",
  checkpoint:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  treasure:    "bg-amber-100 text-amber-700 border-amber-200",
  story:       "bg-stone-100 text-stone-600 border-stone-200",
}

// ── Minimal chess engine ────────────────────────────────────────────────────
const FILES = ["a","b","c","d","e","f","g","h"]
const PIECES: Record<string, string> = {
  K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",
  k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟",
}

function parseFen(fen: string) {
  const board: (string|null)[][] = Array.from({length:8}, () => Array(8).fill(null))
  const rows = fen.split(" ")[0].split("/")
  rows.forEach((row, r) => {
    let c = 0
    for (const ch of row) {
      if (/\d/.test(ch)) { c += parseInt(ch) }
      else { board[r][c] = ch; c++ }
    }
  })
  return board
}

function algToCoord(alg: string): [number,number] {
  const file = FILES.indexOf(alg[0])
  const rank = 8 - parseInt(alg[1])
  return [rank, file]
}

function PuzzleBoard({ fen, solutionMoves, onSolve }: {
  fen: string
  solutionMoves: string[]
  onSolve: (success: boolean) => void
}) {
  const [board,     setBoard]     = useState(() => parseFen(fen))
  const [selected,  setSelected]  = useState<[number,number]|null>(null)
  const [moveIdx,   setMoveIdx]   = useState(0)
  const [feedback,  setFeedback]  = useState<"correct"|"wrong"|"done"|null>(null)
  const [solved,    setSolved]    = useState(false)

  const applyMove = useCallback((brd: (string|null)[][], from: [number,number], to: [number,number]) => {
    const next = brd.map(r => [...r])
    next[to[0]][to[1]] = next[from[0]][from[1]]
    next[from[0]][from[1]] = null
    return next
  }, [])

  function handleSquare(r: number, c: number) {
    if (solved || feedback === "done") return

    if (selected) {
      const [sr, sc] = selected
      if (sr === r && sc === c) { setSelected(null); return }

      const from = `${FILES[sc]}${8-sr}`
      const to   = `${FILES[c]}${8-r}`
      const move = `${from}${to}`
      const expected = solutionMoves[moveIdx]

      if (move === expected) {
        const newBoard = applyMove(board, selected, [r,c])
        setBoard(newBoard)
        setSelected(null)

        const nextIdx = moveIdx + 1
        if (nextIdx >= solutionMoves.length) {
          setFeedback("done")
          setSolved(true)
          setTimeout(() => onSolve(true), 800)
        } else {
          setFeedback("correct")
          setMoveIdx(nextIdx)
          setTimeout(() => {
            setFeedback(null)
            // play opponent response
            const oppMove = solutionMoves[nextIdx]
            if (oppMove) {
              const oppFrom = algToCoord(oppMove.slice(0,2))
              const oppTo   = algToCoord(oppMove.slice(2,4))
              setBoard(prev => applyMove(prev, oppFrom, oppTo))
              setMoveIdx(nextIdx + 1)
            }
          }, 700)
        }
      } else {
        setFeedback("wrong")
        setSelected(null)
        setTimeout(() => setFeedback(null), 900)
      }
    } else {
      if (board[r][c]) setSelected([r, c])
    }
  }

  const activeColor = fen.split(" ")[1] === "b" ? "black" : "white"

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Feedback banner */}
      {feedback && (
        <div className={`w-full text-center rounded-xl py-2 text-sm font-bold ${
          feedback === "correct" ? "bg-emerald-100 text-emerald-700" :
          feedback === "done"    ? "bg-green-800 text-white" :
          "bg-red-100 text-red-700"
        }`}>
          {feedback === "correct" ? "✓ Correct!" : feedback === "done" ? "🎉 Puzzle solved!" : "✗ Try again"}
        </div>
      )}

      {/* Board */}
      <div className="border-2 border-stone-700 rounded overflow-hidden shadow-lg">
        {board.map((row, r) => (
          <div key={r} className="flex">
            {row.map((piece, c) => {
              const isLight    = (r + c) % 2 === 0
              const isSel      = selected?.[0] === r && selected?.[1] === c
              const isHint     = selected && !feedback &&
                                  moveIdx < solutionMoves.length &&
                                  solutionMoves[moveIdx].slice(0,2) === `${FILES[selected[1]]}${8-selected[0]}` &&
                                  solutionMoves[moveIdx].slice(2,4) === `${FILES[c]}${8-r}`
              return (
                <button
                  key={c}
                  onClick={() => handleSquare(r,c)}
                  className={`w-10 h-10 flex items-center justify-center text-xl relative transition-colors ${
                    isSel   ? "bg-amber-400" :
                    isLight ? "bg-amber-100" : "bg-green-800"
                  }`}
                >
                  {isHint && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className={`w-3 h-3 rounded-full opacity-50 ${piece ? "border-2 border-amber-400" : "bg-amber-400"}`} />
                    </span>
                  )}
                  {piece && (
                    <span className={`select-none leading-none z-10 ${
                      piece === piece.toUpperCase() ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" : "text-stone-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]"
                    }`}>
                      {PIECES[piece] ?? piece}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Coordinates hint */}
      <p className="text-xs text-stone-400">{activeColor === "white" ? "White" : "Black"} to move · Tap piece then target</p>

      {/* Show solution */}
      {feedback === "wrong" && (
        <button
          onClick={() => {
            const mv = solutionMoves[moveIdx]
            if (mv) {
              const from = algToCoord(mv.slice(0,2))
              const to   = algToCoord(mv.slice(2,4))
              setBoard(prev => applyMove(prev, from, to))
              setMoveIdx(moveIdx + 1)
              if (moveIdx + 1 >= solutionMoves.length) {
                setFeedback("done"); setSolved(true); setTimeout(() => onSolve(false), 800)
              } else setFeedback(null)
            }
          }}
          className="text-xs text-stone-400 underline"
        >
          Show next move
        </button>
      )}
    </div>
  )
}

// ── Puzzle modal ─────────────────────────────────────────────────────────────
function PuzzleModal({ node, playerId, onClose }: {
  node: Node
  playerId: string
  onClose: (completed: boolean) => void
}) {
  const [result, setResult] = useState<"success"|"fail"|null>(null)

  async function handleSolve(success: boolean) {
    setResult(success ? "success" : "fail")
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (supabase.from("quest_completions") as any)
      .select("id").eq("player_id", playerId).eq("quest_node_id", node.id).maybeSingle()
    if (!existing.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("quest_completions") as any).insert({
        player_id: playerId, quest_node_id: node.id,
        status: "completed", attempts: 1, hints_used: success ? 0 : 1,
        xp_earned: success ? node.xp_reward : Math.round(node.xp_reward * 0.5),
        gold_earned: success ? node.gold_reward : 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    }
    setTimeout(() => onClose(true), 1400)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={() => onClose(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-green-900 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">{node.title}</p>
            <p className="text-green-300 text-xs capitalize">{node.node_type.replace("_"," ")} · +{node.xp_reward} XP · +{node.gold_reward}🪙</p>
          </div>
          <button onClick={() => onClose(false)} className="text-green-300 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-4">
          {result ? (
            <div className={`rounded-xl py-8 text-center ${result === "success" ? "bg-emerald-50" : "bg-amber-50"}`}>
              <span className="text-5xl">{result === "success" ? "🎉" : "📚"}</span>
              <p className={`mt-3 font-bold ${result === "success" ? "text-emerald-700" : "text-amber-700"}`}>
                {result === "success" ? "Brilliant!" : "Good effort!"}
              </p>
              <p className="text-xs text-stone-400 mt-1">+{result === "success" ? node.xp_reward : Math.round(node.xp_reward * 0.5)} XP earned</p>
            </div>
          ) : node.fen_position && node.solution_moves ? (
            <PuzzleBoard
              fen={node.fen_position}
              solutionMoves={node.solution_moves}
              onSolve={handleSolve}
            />
          ) : (
            <div className="py-10 text-center">
              <span className="text-4xl">{NODE_ICON[node.node_type] ?? "⚔️"}</span>
              <p className="mt-3 text-stone-700 font-medium">{node.title}</p>
              <p className="text-sm text-stone-400 mt-1">Complete this {node.node_type} to earn {node.xp_reward} XP and {node.gold_reward} 🪙</p>
              <button
                onClick={() => handleSolve(true)}
                className="mt-4 px-5 py-2 bg-green-800 text-white text-sm font-bold rounded-xl hover:bg-green-700"
              >
                Mark Complete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function QuestsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [level,       setLevel]       = useState(1)
  const [gold,        setGold]        = useState(0)
  const [streak,      setStreak]      = useState(0)
  const [srDue,       setSrDue]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [playerId,    setPlayerId]    = useState<string|null>(null)
  const [activeNode,  setActiveNode]  = useState<Node|null>(null)

  async function loadData(supabase: ReturnType<typeof createClient>, pid: string) {
    const [gpRes, assignRes, srRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("player_game_profiles") as any)
        .select("current_level, gold_balance, streak_current")
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

    const raw = assignRes.data ?? []
    const enriched: Assignment[] = await Promise.all(raw.map(async (a: {id: string; campaign_id: string; expires_at: string | null; quest_campaigns: Campaign | null}) => {
      const [nodesRes, compRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_nodes") as any)
          .select("id, title, node_type, position_order, xp_reward, gold_reward, is_locked, unlock_level, difficulty_rating, fen_position, solution_moves")
          .eq("campaign_id", a.campaign_id).order("position_order"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_completions") as any)
          .select("quest_node_id, status, xp_earned, gold_earned")
          .eq("player_id", pid),
      ])
      return { ...a, nodes: nodesRes.data ?? [], completions: compRes.data ?? [] }
    }))

    setAssignments(enriched)
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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  function handleNodeClick(n: Node, lvl: number) {
    if (n.is_locked && lvl < (n.unlock_level ?? 0)) return
    setActiveNode(n)
  }

  async function handleModalClose(completed: boolean) {
    setActiveNode(null)
    if (completed && playerId) {
      const supabase = createClient()
      await loadData(supabase, playerId)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {activeNode && playerId && (
        <PuzzleModal node={activeNode} playerId={playerId} onClose={handleModalClose} />
      )}

      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-lg">Quest Map</span>
        </div>
        <button onClick={handleSignOut} className="text-sm text-green-200 hover:text-white">Sign out</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "♚", label: "Level",  value: level       },
                { icon: "🪙", label: "Gold",   value: gold        },
                { icon: "🔥", label: "Streak", value: `${streak}d` },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-stone-200 p-3 text-center shadow-sm">
                  <span className="text-xl">{s.icon}</span>
                  <p className="text-base font-bold text-stone-900 mt-1">{s.value}</p>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Boss returns due */}
            {srDue > 0 && (
              <div className="bg-red-900 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-3xl">👹</span>
                <div>
                  <p className="text-white font-bold text-sm">Boss Returns Due!</p>
                  <p className="text-red-200 text-xs mt-0.5">{srDue} boss encounter{srDue > 1 ? "s" : ""} ready for your rematch</p>
                </div>
              </div>
            )}

            {/* Campaigns */}
            {assignments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-5xl">⚔️</span>
                <p className="mt-3 text-stone-600 font-bold">No active quests</p>
                <p className="text-sm text-stone-400 mt-1">Your coach will assign campaigns here.</p>
              </div>
            ) : (
              assignments.map(a => {
                const c = a.quest_campaigns
                const completed  = a.completions.filter(x => x.status === "completed").length
                const total      = a.nodes.length
                const pct        = total > 0 ? Math.round((completed / total) * 100) : 0
                const totalXp    = a.completions.reduce((s, x) => s + (x.xp_earned ?? 0), 0)
                const totalGold  = a.completions.reduce((s, x) => s + (x.gold_earned ?? 0), 0)
                const compSet    = new Set(a.completions.filter(x => x.status === "completed").map(x => x.quest_node_id))

                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                    {/* Campaign header */}
                    <div className="bg-green-900 px-4 py-4 flex items-center gap-3">
                      <span className="text-3xl flex-shrink-0">{c?.cover_emoji ?? "⚔️"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold truncate">{c?.title ?? "Campaign"}</p>
                        {c?.description && (
                          <p className="text-green-300 text-xs mt-0.5 line-clamp-1">{c.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-amber-400 text-xs font-bold">{completed}/{total}</p>
                        <p className="text-green-400 text-[10px]">nodes</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-stone-100">
                      <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    {/* Earned summary */}
                    {(totalXp > 0 || totalGold > 0) && (
                      <div className="flex items-center gap-4 px-4 py-2 bg-stone-50 border-b border-stone-100">
                        {totalXp > 0 && <span className="text-xs text-amber-700 font-semibold">+{totalXp} XP earned</span>}
                        {totalGold > 0 && <span className="text-xs text-amber-600 font-semibold">+{totalGold} 🪙 earned</span>}
                      </div>
                    )}

                    {/* Nodes */}
                    <div className="divide-y divide-stone-50">
                      {a.nodes.map((n, i) => {
                        const done      = compSet.has(n.id)
                        const locked    = n.is_locked && level < (n.unlock_level ?? 0)
                        const isCurrent = !done && !locked && i === a.nodes.findIndex(nd => !compSet.has(nd.id) && !(nd.is_locked && level < (nd.unlock_level ?? 0)))
                        const playable  = !locked && n.node_type !== "story"
                        return (
                          <button
                            key={n.id}
                            onClick={() => !locked && handleNodeClick(n, level)}
                            disabled={locked}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isCurrent ? "bg-amber-50 hover:bg-amber-100" :
                              done      ? "hover:bg-stone-50" :
                              locked    ? "opacity-50 cursor-not-allowed" :
                              "hover:bg-stone-50"
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm flex-shrink-0 ${
                              done    ? "bg-emerald-100 border-emerald-200" :
                              locked  ? "bg-stone-100 border-stone-200" :
                              isCurrent ? "bg-amber-100 border-amber-300" :
                              NODE_COLOR[n.node_type] ?? "bg-stone-100 border-stone-200"
                            }`}>
                              {done ? "✓" : locked ? "🔒" : NODE_ICON[n.node_type] ?? "❓"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${done ? "text-stone-400 line-through" : locked ? "text-stone-300" : "text-stone-800"}`}>
                                {n.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-stone-400 capitalize">{n.node_type.replace("_"," ")}</span>
                                {n.xp_reward > 0 && <span className="text-[10px] text-amber-600">+{n.xp_reward} XP</span>}
                                {n.gold_reward > 0 && <span className="text-[10px] text-amber-500">+{n.gold_reward}🪙</span>}
                                {n.fen_position && !done && <span className="text-[10px] text-blue-500">♟ Puzzle</span>}
                              </div>
                            </div>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 shrink-0">Next</span>
                            )}
                            {playable && !done && !locked && (
                              <span className="text-stone-300 text-lg shrink-0">›</span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {a.expires_at && (
                      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100">
                        <p className="text-[10px] text-stone-400">
                          Expires {new Date(a.expires_at).toLocaleDateString("en-KE", { day:"numeric", month:"short" })}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
