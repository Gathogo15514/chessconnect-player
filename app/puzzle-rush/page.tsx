"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { BottomNav } from "@/components/BottomNav"
import ChessBoard from "@/components/chess/ChessBoard"
import type { ThemeId, PieceSetId } from "@/components/chess/themes"

const RUSH_DURATION = 180 // 3 minutes in seconds

type Puzzle = {
  id: string
  fen_position: string
  solution_moves: string[]
  xp_reward: number
}

type Phase = "idle" | "playing" | "done"

export default function PuzzleRushPage() {
  const router = useRouter()

  const [phase,       setPhase]       = useState<Phase>("idle")
  const [timeLeft,    setTimeLeft]    = useState(RUSH_DURATION)
  const [score,       setScore]       = useState(0)
  const [combo,       setCombo]       = useState(0)
  const [bestCombo,   setBestCombo]   = useState(0)
  const [solved,      setSolved]      = useState(0)
  const [failed,      setFailed]      = useState(0)
  const [puzzle,      setPuzzle]      = useState<Puzzle | null>(null)
  const [puzzleKey,   setPuzzleKey]   = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [playerId,    setPlayerId]    = useState<string | null>(null)
  const [themeId,     setThemeId]     = useState<ThemeId>("classic")
  const [pieceSetId,  setPieceSetId]  = useState<PieceSetId>("standard")
  const [flipped,     setFlipped]     = useState(false)
  const [comboAnim,   setComboAnim]   = useState(false)

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const usedIds     = useRef<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) return
      setPlayerId(player.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gp } = await (supabase.from("player_game_profiles") as any)
        .select("board_theme, piece_set, board_flipped").eq("player_id", player.id).maybeSingle()
      if (gp?.board_theme) setThemeId(gp.board_theme as ThemeId)
      if (gp?.piece_set)   setPieceSetId(gp.piece_set as PieceSetId)
      if (typeof gp?.board_flipped === "boolean") setFlipped(gp.board_flipped)
    })
  }, [router])

  async function fetchPuzzle() {
    setLoading(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (supabase.from("quest_nodes") as any)
      .select("id, fen_position, solution_moves, xp_reward")
      .not("fen_position", "is", null)
      .not("solution_moves", "is", null)
      .limit(50)

    const candidates = (rows ?? []).filter(
      (r: Puzzle) => r.fen_position && r.solution_moves?.length && !usedIds.current.has(r.id)
    )
    if (candidates.length === 0) {
      usedIds.current.clear()
      if (rows?.length) {
        const r = rows[Math.floor(Math.random() * rows.length)] as Puzzle
        usedIds.current.add(r.id)
        setPuzzle(r)
        setPuzzleKey(k => k + 1)
      }
    } else {
      const r = candidates[Math.floor(Math.random() * candidates.length)] as Puzzle
      usedIds.current.add(r.id)
      setPuzzle(r)
      setPuzzleKey(k => k + 1)
    }
    setLoading(false)
  }

  function startRush() {
    usedIds.current.clear()
    setScore(0)
    setCombo(0)
    setBestCombo(0)
    setSolved(0)
    setFailed(0)
    setTimeLeft(RUSH_DURATION)
    setPhase("playing")
    fetchPuzzle()

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          setPhase("done")
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  function handleSolve() {
    setCombo(c => {
      const next = c + 1
      setBestCombo(b => Math.max(b, next))
      const multiplier = next >= 5 ? 3 : next >= 3 ? 2 : 1
      const pts = (puzzle?.xp_reward ?? 10) * multiplier
      setScore(s => s + pts)
      setComboAnim(true)
      setTimeout(() => setComboAnim(false), 600)
      return next
    })
    setSolved(s => s + 1)
    // add 3s bonus per solve
    setTimeLeft(t => Math.min(t + 3, RUSH_DURATION))
    setTimeout(() => fetchPuzzle(), 500)
  }

  function handleSkip() {
    setCombo(0)
    setFailed(f => f + 1)
    fetchPuzzle()
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Award XP when session ends
  useEffect(() => {
    if (phase !== "done" || !playerId || score === 0) return
    const supabase = createClient()
    supabase.rpc("award_xp_gold", {
      p_player_id:   playerId,
      p_xp:          score,
      p_gold:        Math.floor(score / 10),
      p_event_type:  "puzzle_rush",
      p_description: `Puzzle Rush: ${solved} solved, best combo ×${bestCombo}`,
    }).then(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timerColor = timeLeft <= 30 ? "text-red-500" : timeLeft <= 60 ? "text-amber-500" : "text-emerald-600"
  const multiplier = combo >= 5 ? 3 : combo >= 3 ? 2 : 1

  return (
    <div className="min-h-screen bg-stone-950 pb-20">
      <header className="bg-stone-900 border-b border-stone-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-stone-400 hover:text-white text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-lg">⚡</span>
          <span className="font-bold text-white">Puzzle Rush Arena</span>
        </div>
        <div className="w-12" />
      </header>

      <main className="max-w-sm mx-auto px-4 py-4 space-y-4">

        {/* Timer + score bar */}
        {phase !== "idle" && (
          <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-3xl font-mono font-black tabular-nums ${timerColor}`}>
                  {mins}:{secs.toString().padStart(2, "0")}
                </p>
                <p className="text-stone-500 text-xs mt-0.5">time remaining</p>
              </div>
              <div className="text-right">
                <p className="text-amber-400 text-2xl font-black tabular-nums">{score}</p>
                <p className="text-stone-500 text-xs mt-0.5">score</p>
              </div>
            </div>

            {/* combo bar */}
            {phase === "playing" && (
              <div className="mt-3 flex items-center gap-3">
                <div className={`flex items-center gap-1.5 transition-all ${comboAnim ? "scale-125" : "scale-100"}`}>
                  <span className="text-base">🔥</span>
                  <span className="text-white font-black text-lg tabular-nums">{combo}x</span>
                </div>
                <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (combo / 5) * 100)}%`,
                      background: combo >= 5 ? "#f59e0b" : combo >= 3 ? "#f97316" : "#10b981",
                    }}
                  />
                </div>
                {multiplier > 1 && (
                  <span className="text-amber-400 text-xs font-bold bg-amber-400/10 px-2 py-0.5 rounded-full">
                    ×{multiplier}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Idle state */}
        {phase === "idle" && (
          <div className="text-center py-8 space-y-6">
            <div>
              <span className="text-7xl">⚡</span>
              <h1 className="text-2xl font-black text-white mt-4">Puzzle Rush Arena</h1>
              <p className="text-stone-400 mt-2 text-sm">Solve as many puzzles as you can in 3 minutes!</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { icon: "🔥", label: "Combo ×3", desc: "5+ in a row" },
                { icon: "⏱️", label: "+3 sec",   desc: "per solve"   },
                { icon: "🏆", label: "Top Score", desc: "beat your best" },
              ].map(c => (
                <div key={c.label} className="bg-stone-900 border border-stone-800 rounded-xl p-3">
                  <span className="text-2xl">{c.icon}</span>
                  <p className="text-white text-xs font-bold mt-1">{c.label}</p>
                  <p className="text-stone-500 text-[10px]">{c.desc}</p>
                </div>
              ))}
            </div>
            <button
              onClick={startRush}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-lg rounded-2xl transition-colors"
            >
              ⚡ Start Rush!
            </button>
          </div>
        )}

        {/* Playing state */}
        {phase === "playing" && (
          <div className="space-y-3">
            {loading || !puzzle ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="bg-stone-900 rounded-2xl border border-stone-800 p-4 flex flex-col items-center">
                  <ChessBoard
                    key={puzzleKey}
                    fen={puzzle.fen_position}
                    solutionMoves={puzzle.solution_moves}
                    themeId={themeId}
                    pieceSetId={pieceSetId}
                    flipped={flipped}
                    onSolve={handleSolve}
                    onCaptureSuccess={() => {}}
                    onNodeCleared={() => {}}
                  />
                </div>
                <button
                  onClick={handleSkip}
                  className="w-full py-3 border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 rounded-xl text-sm font-medium transition-colors"
                >
                  Skip (lose combo)
                </button>
              </>
            )}
          </div>
        )}

        {/* Done state */}
        {phase === "done" && (
          <div className="text-center py-6 space-y-5">
            <div>
              <span className="text-6xl">🏆</span>
              <h2 className="text-2xl font-black text-white mt-3">Time&apos;s Up!</h2>
            </div>
            <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5 space-y-3">
              {[
                { label: "Final Score",  value: score,               color: "text-amber-400" },
                { label: "Puzzles Solved", value: solved,            color: "text-emerald-400" },
                { label: "Skipped",      value: failed,              color: "text-red-400"    },
                { label: "Best Combo",   value: `${bestCombo}x`,     color: "text-orange-400" },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center">
                  <span className="text-stone-400 text-sm">{s.label}</span>
                  <span className={`font-black text-lg tabular-nums ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={startRush}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl transition-colors"
              >
                ⚡ Play Again
              </button>
              <button
                onClick={() => router.push("/quests")}
                className="flex-1 py-3 border border-stone-700 text-stone-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
              >
                Quest Map
              </button>
            </div>
          </div>
        )}

        {/* Stats row (always visible when playing/done) */}
        {phase !== "idle" && (
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-3">
              <p className="text-emerald-400 text-xl font-black">{solved}</p>
              <p className="text-stone-500 text-[10px] uppercase tracking-wide">Solved</p>
            </div>
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-3">
              <p className="text-red-400 text-xl font-black">{failed}</p>
              <p className="text-stone-500 text-[10px] uppercase tracking-wide">Skipped</p>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
