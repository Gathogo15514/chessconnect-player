"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { bufferAttempt, submitBuffered, startRetryLoop } from "@/lib/chess/offline-buffer"
import { ChessBoard } from "@/components/chess/ChessBoard"
import { useBoardSettings } from "@/components/chess/BoardSettingsProvider"
import { useActivity, type Activity } from "@/lib/chess/activity"

const MAIN_API = process.env.NEXT_PUBLIC_MAIN_API_URL ?? ""

type Puzzle = {
  item_id:        string
  puzzle_id:      string
  title:          string
  initial_fen:    string
  target_color:   "white" | "black"
  solution_moves: string[]
  xp_reward:      number
}

type AssignmentData = {
  assignment_id:  string
  title:          string
  total_exercises: number
  puzzles:        Puzzle[]
}

type PuzzleResult = "solved" | "failed" | null

export default function AssignmentWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [data,          setData]         = useState<AssignmentData | null>(null)
  const [playerId,      setPlayerId]     = useState<string | null>(null)
  const [idx,           setIdx]          = useState(0)
  const [results,       setResults]      = useState<Record<string, PuzzleResult>>({})
  const [attempts,      setAttempts]     = useState<Record<string, number>>({})
  const [finished,      setFinished]     = useState(false)
  const [submitting,    setSubmitting]   = useState(false)
  const [error,         setError]        = useState<string | null>(null)
  const startedAt = useRef<number>(0)
  const handledPuzzleRef = useRef<string | null>(null)
  const accessTokenRef = useRef<string>("")
  const { settings } = useBoardSettings()

  useEffect(() => {
    // Ref mutations can't happen during render under this project's strict
    // purity rules, so the mount timestamp is captured here instead. User
    // interaction (which is all that reads it) can't happen before mount.
    startedAt.current = Date.now()
  }, [])

  useEffect(() => {
    params.then(p => setAssignmentId(p.id))
  }, [params])

  useEffect(() => {
    if (!assignmentId) return
    const supabase = createClient()
    // Get session first — use Bearer token to avoid ISO-8859-1 header issues
    // that occur when passing raw cookie values across origins
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return }
      setPlayerId(session.user.id)
      accessTokenRef.current = session.access_token

      fetch(`${MAIN_API}/api/v1/player/assignments/active`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache:   "no-store",
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return
          const found = (d.assignments ?? []).find((a: AssignmentData) => a.assignment_id === assignmentId)
          if (found) setData(found)
          else setError("Assignment not found or not active.")
        })
        .catch(() => setError("Could not load assignment. Check your connection."))
    })
  }, [assignmentId])

  const puzzle = data?.puzzles[idx]

  const activityValue: Activity = puzzle
    ? { id: puzzle.puzzle_id, type: "puzzle", fen: puzzle.initial_fen, solutionMoves: puzzle.solution_moves }
    : { id: "loading", type: "practice", fen: "8/8/8/8/8/8/8/8 w - - 0 1" }
  const activity = useActivity(activityValue)

  useEffect(() => {
    if (!puzzle || !playerId || !assignmentId) return
    if (activity.feedback !== "complete") return
    if (handledPuzzleRef.current === puzzle.puzzle_id) return
    handledPuzzleRef.current = puzzle.puzzle_id

    const att = (attempts[puzzle.puzzle_id] ?? 0) + activity.wrongAttempts + 1
    setResults(r => ({ ...r, [puzzle.puzzle_id]: "solved" }))
    bufferAttempt({
      puzzle_id:    puzzle.puzzle_id,
      item_id:      puzzle.item_id,
      status:       "PASSED",
      attempts:     att,
      seconds_taken: Math.floor((Date.now() - startedAt.current) / 1000),
      moves_played:  puzzle.solution_moves,
      buffered_at:   Date.now(),
    })
    setAttempts(a => ({ ...a, [puzzle.puzzle_id]: att }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.feedback, puzzle, playerId, assignmentId])

  async function handleNext() {
    if (!data || !playerId || !assignmentId) return
    const nextIdx = idx + 1
    if (nextIdx >= data.puzzles.length) {
      // All done — submit
      setSubmitting(true)
      const secs = Math.floor((Date.now() - startedAt.current) / 1000)
      const result = await submitBuffered(assignmentId, playerId, secs, accessTokenRef.current)
      if (!result.ok) {
        startRetryLoop(assignmentId, playerId, secs, accessTokenRef.current, () => setFinished(true))
      }
      setFinished(true)
      setSubmitting(false)
    } else {
      setIdx(nextIdx)
      startedAt.current = Date.now()
    }
  }

  async function handleSkip() {
    if (!puzzle || !playerId) return
    await bufferAttempt({
      puzzle_id:    puzzle.puzzle_id,
      item_id:      puzzle.item_id,
      status:       "SKIPPED",
      attempts:     activity.wrongAttempts,
      seconds_taken: Math.floor((Date.now() - startedAt.current) / 1000),
      moves_played:  [],
      buffered_at:   Date.now(),
    })
    setResults(r => ({ ...r, [puzzle.puzzle_id]: "failed" }))
    handleNext()
  }

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#070B17", padding: "0 16px" }}>
      <div className="text-center">
        <span className="text-4xl">⚠️</span>
        <p className="mt-3 text-stone-700 font-medium">{error}</p>
        <Link href="/train" className="mt-4 inline-block text-sm text-green-800 underline">Back to assignments</Link>
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#070B17" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #10B981", borderTopColor: "transparent", borderRadius: "50%", animation: "cc-spin 0.9s linear infinite" }} />
    </div>
  )

  const totalSolved  = Object.values(results).filter(r => r === "solved").length
  const progress     = Math.round((idx / data.total_exercises) * 100)

  if (finished) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#070B17", padding: "0 16px" }}>
      <div style={{ background: "#121829", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 32, maxWidth: 384, width: "100%", textAlign: "center" }}>
        <span style={{ fontSize: 52 }}>🏆</span>
        <h2 style={{ fontFamily: "var(--cc-font-display)", fontWeight: 800, fontSize: 22, color: "#F1F5F9", marginTop: 16 }}>Mission Complete!</h2>
        <p style={{ color: "#64748B", marginTop: 8, fontSize: 14 }}>
          {totalSolved} of {data.total_exercises} puzzles solved
        </p>
        <div style={{ marginTop: 16, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 12, padding: 12, textAlign: "left" }}>
          <p style={{ fontSize: 12, color: "#475569" }}>Results synced to your coach ✓</p>
        </div>
        <Link href="/train"
           style={{ marginTop: 20, display: "block", width: "100%", background: "linear-gradient(135deg, #0D8A5C, #10B981)", color: "#fff", borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 800, fontFamily: "var(--cc-font-display)", textDecoration: "none", boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}>
          Back to Missions
        </Link>
      </div>
    </div>
  )

  const isSolved = activity.feedback === "complete"

  return (
    <div style={{ minHeight: "100vh", background: "#070B17", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #0D1224, #121829)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
        <Link href="/train" style={{ color: "#475569", fontSize: 13, textDecoration: "none" }}>← Missions</Link>
        <span className="font-semibold text-sm truncate max-w-[200px]">{data.title}</span>
        <span className="text-green-200 text-sm">{idx + 1}/{data.total_exercises}</span>
      </header>

      {/* Progress */}
      <div className="h-1 bg-stone-200">
        <div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <main className="flex-1 flex flex-col items-center px-4 py-6 gap-5 max-w-lg mx-auto w-full">
        {puzzle ? (
          <>
            <div className="w-full">
              <p className="text-xs text-stone-400 mb-1">Puzzle {idx + 1}</p>
              <p className="font-semibold text-stone-800">{puzzle.title}</p>
              <p className="text-sm text-stone-500 mt-0.5">
                {puzzle.target_color === "white" ? "White" : "Black"} to move
              </p>
            </div>

            <ChessBoard
              key={puzzle.puzzle_id}
              fen={activity.fen}
              onMove={(from, to, promotion) => activity.attemptMove(from, to, promotion)}
              getLegalTargets={sq => activity.busy ? [] : activity.engine.legalTargets(sq)}
              getNeedsPromotion={(from, to) => activity.needsPromotion(from, to)}
              lastMove={activity.lastMove}
              checkedSquare={activity.engine.checkedKingSquare}
              movableColor={puzzle.target_color === "white" ? "w" : "b"}
              interactive={!isSolved}
              flipped={settings.boardFlipped}
              settings={settings}
              className="mx-auto w-full max-w-sm"
            />

            {activity.wrongAttempts > 0 && !isSolved && (
              <p className="text-sm text-red-600 text-center">
                {activity.wrongAttempts} wrong {activity.wrongAttempts === 1 ? "move" : "moves"} — keep trying!
                {activity.wrongAttempts >= 3 && (
                  <button onClick={activity.reveal} className="ml-2 underline text-red-400">Reveal answer</button>
                )}
              </p>
            )}

            <div className="flex gap-3 w-full">
              <button
                onClick={handleSkip}
                className="flex-1 border border-stone-300 text-stone-600 rounded-xl py-2.5 text-sm font-medium hover:bg-stone-100 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                disabled={!isSolved || submitting}
                className="flex-1 bg-green-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                {submitting ? "Saving…" : idx + 1 >= data.total_exercises ? "Finish" : "Next →"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-stone-500">Loading puzzle…</p>
        )}
      </main>
    </div>
  )
}
