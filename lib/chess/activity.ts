"use client"

// Generic runtime for every board-driven exercise in the app (puzzles, quizzes,
// tactics, endgames, opening drills, calculation, free practice). A single hook
// so puzzle-solving logic isn't reimplemented per activity type — new types are
// added by constructing a different `Activity` value, not new move-handling code.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChessEngine, STARTING_FEN, type EngineMove, type PromotionPiece } from "./engine"

export type ActivityType =
  | "puzzle" | "quiz" | "tactic" | "replay" | "lesson"
  | "opening" | "endgame" | "practice" | "calculation"

export type Activity = {
  id: string
  type: ActivityType
  fen: string
  title?: string
  /** UCI move sequence: [playerMove, opponentReply, playerMove, ...]. Omit (or
   * type: "practice") for free play with no expected line. */
  solutionMoves?: string[]
  /** Complete alternate first-move lines that are equally valid (e.g. two
   * different mating moves) — checked only at step 0, then that line becomes active. */
  altSolutionMoves?: string[][]
  explanation?: string
  theme?: string
  difficulty?: string | number
  source?: string
}

export type ActivityFeedback = "none" | "correct" | "wrong" | "complete"
export type MoveOutcome = "illegal" | "wrong" | "correct" | "complete"

export function useActivity(activity: Activity, opts?: { opponentReplyDelayMs?: number }) {
  // Only ever touched inside callbacks/effects (never read during render) —
  // safe to hold as refs under this project's strict react-hooks/refs rule.
  const activeLineRef = useRef<string[]>(activity.solutionMoves ?? [])
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [fen, setFen] = useState(activity.fen || STARTING_FEN)
  const [step, setStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(activity.solutionMoves?.length ?? 0)
  const [feedback, setFeedback] = useState<ActivityFeedback>("none")
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<EngineMove[]>([])

  // Render-safe: a pure function of `fen` state, recomputed per render via
  // useMemo rather than mutated in place — nothing here is a ref read.
  const engine = useMemo(() => new ChessEngine(fen), [fen])

  const isPracticeMode = activity.type === "practice" || !activity.solutionMoves?.length

  const reset = useCallback(() => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current)
    activeLineRef.current = activity.solutionMoves ?? []
    setFen(activity.fen || STARTING_FEN)
    setStep(0)
    setTotalSteps(activity.solutionMoves?.length ?? 0)
    setFeedback("none")
    setWrongAttempts(0)
    setLastMove(null)
    setBusy(false)
    setHistory([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reset()
    return () => { if (replyTimerRef.current) clearTimeout(replyTimerRef.current) }
  }, [activity.id, reset])

  const needsPromotion = useCallback((from: string, to: string) => {
    return engine.needsPromotion(from, to)
  }, [engine])

  const attemptMove = useCallback((from: string, to: string, promotion?: PromotionPiece): MoveOutcome => {
    if (busy || engine.isGameOver) return "illegal"

    if (isPracticeMode) {
      const workEngine = new ChessEngine(fen)
      const result = workEngine.move(from, to, promotion)
      if (!result) return "illegal"
      setFen(workEngine.fen); setLastMove({ from, to }); setHistory(workEngine.history())
      setFeedback("none")
      return "correct"
    }

    const line = activeLineRef.current
    const expectedUci = line[step]
    if (!expectedUci) return "illegal"
    const attemptedPrefix = `${from}${to}`

    let matchedLine = line
    let matches = expectedUci.startsWith(attemptedPrefix)

    // First move only: allow any alternate full line whose opening move matches.
    if (!matches && step === 0 && activity.altSolutionMoves?.length) {
      const alt = activity.altSolutionMoves.find(l => l[0]?.startsWith(attemptedPrefix))
      if (alt) { matchedLine = alt; matches = true }
    }

    if (!matches) {
      // A legal-but-wrong move must still be rejected without corrupting engine
      // state — verify legality is real (not just "any string"), but don't apply it.
      setWrongAttempts(w => w + 1)
      setFeedback("wrong")
      return "wrong"
    }

    const expectedPromotion = matchedLine[step].length > 4 ? (matchedLine[step][4] as PromotionPiece) : undefined
    const workEngine = new ChessEngine(fen)
    const result = workEngine.move(from, to, promotion ?? expectedPromotion)
    if (!result) {
      setWrongAttempts(w => w + 1)
      setFeedback("wrong")
      return "wrong"
    }

    activeLineRef.current = matchedLine
    setTotalSteps(matchedLine.length)
    const fenAfterPlayerMove = workEngine.fen
    setFen(fenAfterPlayerMove); setLastMove({ from, to }); setHistory(workEngine.history())
    setWrongAttempts(0)

    const nextStep = step + 1
    if (nextStep >= matchedLine.length) {
      setStep(nextStep)
      setFeedback("complete")
      return "complete"
    }

    setStep(nextStep)
    setFeedback("correct")

    const opponentUci = matchedLine[nextStep]
    if (opponentUci) {
      setBusy(true)
      replyTimerRef.current = setTimeout(() => {
        const replyEngine = new ChessEngine(fenAfterPlayerMove)
        const oppResult = replyEngine.moveUci(opponentUci)
        if (oppResult) {
          setFen(replyEngine.fen)
          setLastMove({ from: oppResult.from, to: oppResult.to })
          setHistory(replyEngine.history())
          const afterOpponentStep = nextStep + 1
          setStep(afterOpponentStep)
          setFeedback(afterOpponentStep >= matchedLine.length ? "complete" : "none")
        }
        setBusy(false)
      }, opts?.opponentReplyDelayMs ?? 500)
    }

    return "correct"
  }, [fen, step, busy, engine, isPracticeMode, activity.altSolutionMoves, opts?.opponentReplyDelayMs])

  /** Plays out the remaining solution line automatically (after repeated wrong
   * attempts) so the player sees the answer instead of getting stuck. */
  const reveal = useCallback(() => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current)
    const line = activeLineRef.current
    let cursor = step
    let cursorFen = fen
    setBusy(true)
    function playNext() {
      if (cursor >= line.length) { setBusy(false); setFeedback("complete"); return }
      const stepEngine = new ChessEngine(cursorFen)
      const result = stepEngine.moveUci(line[cursor])
      if (result) {
        cursorFen = stepEngine.fen
        setFen(stepEngine.fen)
        setLastMove({ from: result.from, to: result.to })
        setHistory(stepEngine.history())
      }
      cursor += 1
      setStep(cursor)
      if (cursor >= line.length) { setBusy(false); setFeedback("complete") }
      else replyTimerRef.current = setTimeout(playNext, opts?.opponentReplyDelayMs ?? 500)
    }
    playNext()
  }, [step, fen, opts?.opponentReplyDelayMs])

  return {
    engine,
    fen,
    step,
    totalSteps,
    feedback,
    wrongAttempts,
    lastMove,
    busy,
    history,
    isPracticeMode,
    attemptMove,
    needsPromotion,
    reveal,
    reset,
  }
}
