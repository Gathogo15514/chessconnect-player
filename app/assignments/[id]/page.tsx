"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { bufferAttempt, submitBuffered, startRetryLoop } from "@/lib/chess/offline-buffer"

const ChessBoard = dynamic(
  () => import("@/components/ChessBoard").then(m => ({ default: m.ChessBoard })),
  { ssr: false, loading: () => <div className="w-full max-w-sm mx-auto aspect-square bg-stone-200 animate-pulse rounded-xl" /> }
)

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
  const [wrongCount,    setWrongCount]   = useState(0)
  const [finished,      setFinished]     = useState(false)
  const [submitting,    setSubmitting]   = useState(false)
  const [error,         setError]        = useState<string | null>(null)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    params.then(p => setAssignmentId(p.id))
  }, [params])

  useEffect(() => {
    if (!assignmentId) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setPlayerId(user.id)
    })
    fetch(`${MAIN_API}/api/v1/player/assignments/active`, { credentials: "include", cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const found = (d.assignments ?? []).find((a: AssignmentData) => a.assignment_id === assignmentId)
        if (found) setData(found)
        else setError("Assignment not found or not active.")
      })
      .catch(() => setError("Could not load assignment. Check your connection."))
  }, [assignmentId])

  const puzzle = data?.puzzles[idx]

  const handleSolved = useCallback(async () => {
    if (!puzzle || !playerId || !assignmentId) return
    const att = (attempts[puzzle.puzzle_id] ?? 0) + wrongCount + 1

    setResults(r => ({ ...r, [puzzle.puzzle_id]: "solved" }))

    await bufferAttempt({
      puzzle_id:    puzzle.puzzle_id,
      item_id:      puzzle.item_id,
      status:       "PASSED",
      attempts:     att,
      seconds_taken: Math.floor((Date.now() - startedAt.current) / 1000),
      moves_played:  puzzle.solution_moves,
      buffered_at:   Date.now(),
    })
    setAttempts(a => ({ ...a, [puzzle.puzzle_id]: att }))
    setWrongCount(0)
  }, [puzzle, playerId, assignmentId, attempts, wrongCount])

  const handleWrongMove = useCallback(() => {
    setWrongCount(c => c + 1)
  }, [])

  async function handleNext() {
    if (!data || !playerId || !assignmentId) return
    const nextIdx = idx + 1
    if (nextIdx >= data.puzzles.length) {
      // All done — submit
      setSubmitting(true)
      const secs = Math.floor((Date.now() - startedAt.current) / 1000)
      const result = await submitBuffered(assignmentId, playerId, secs)
      if (!result.ok) {
        startRetryLoop(assignmentId, playerId, secs, () => setFinished(true))
      }
      setFinished(true)
      setSubmitting(false)
    } else {
      setIdx(nextIdx)
      setWrongCount(0)
      startedAt.current = Date.now()
    }
  }

  async function handleSkip() {
    if (!puzzle || !playerId) return
    await bufferAttempt({
      puzzle_id:    puzzle.puzzle_id,
      item_id:      puzzle.item_id,
      status:       "SKIPPED",
      attempts:     wrongCount,
      seconds_taken: Math.floor((Date.now() - startedAt.current) / 1000),
      moves_played:  [],
      buffered_at:   Date.now(),
    })
    setResults(r => ({ ...r, [puzzle.puzzle_id]: "failed" }))
    handleNext()
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="text-center">
        <span className="text-4xl">⚠️</span>
        <p className="mt-3 text-stone-700 font-medium">{error}</p>
        <a href="/assignments" className="mt-4 inline-block text-sm text-green-800 underline">Back to assignments</a>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-8 h-8 border-4 border-green-800 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalSolved  = Object.values(results).filter(r => r === "solved").length
  const progress     = Math.round((idx / data.total_exercises) * 100)

  if (finished) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-8 max-w-sm w-full text-center shadow-sm">
        <span className="text-5xl">🏆</span>
        <h2 className="mt-4 text-xl font-bold text-stone-900">Session Complete!</h2>
        <p className="text-stone-500 mt-2 text-sm">
          {totalSolved} of {data.total_exercises} puzzles solved
        </p>
        <div className="mt-4 bg-stone-50 rounded-xl p-3 text-left space-y-1">
          <p className="text-xs text-stone-400">Results synced to your coach ✓</p>
        </div>
        <a href="/assignments"
           className="mt-6 block w-full bg-green-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors">
          Back to Assignments
        </a>
      </div>
    </div>
  )

  const isSolved = puzzle ? results[puzzle.puzzle_id] === "solved" : false

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <a href="/assignments" className="text-green-200 text-sm">← Back</a>
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
              fen={puzzle.initial_fen}
              solutionMoves={puzzle.solution_moves}
              playerColor={puzzle.target_color === "white" ? "w" : "b"}
              onSolved={handleSolved}
              onWrongMove={handleWrongMove}
            />

            {wrongCount > 0 && !isSolved && (
              <p className="text-sm text-red-600 text-center">
                {wrongCount} wrong {wrongCount === 1 ? "move" : "moves"} — keep trying!
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
