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
  const [comboAnim,   setComboAnim]   = useState(false)

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const usedIds     = useRef<Set<string>>(new Set())
  const puzzleQueue = useRef<Puzzle[]>([])   // pre-loaded next puzzle(s)

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
        .select("board_theme, piece_set").eq("player_id", player.id).maybeSingle()
      if (gp?.board_theme) setThemeId(gp.board_theme as ThemeId)
      if (gp?.piece_set)   setPieceSetId(gp.piece_set as PieceSetId)
    })
  }, [router])

  // Background pre-load: silently fetch next puzzle into queue
  async function preFetch() {
    try {
      const res = await fetch("/api/lichess-puzzle")
      if (!res.ok) return
      const lp = await res.json() as Puzzle
      if (lp.fen_position && lp.solution_moves?.length && !usedIds.current.has(lp.id)) {
        puzzleQueue.current.push(lp)
      }
    } catch { /* silent — pre-fetch is best-effort */ }
  }

  async function fetchPuzzle() {
    setLoading(true)

    // 1. Dequeue from pre-loaded queue (zero wait for player)
    if (puzzleQueue.current.length > 0) {
      const next = puzzleQueue.current.shift()!
      usedIds.current.add(next.id)
      setPuzzle(next)
      setPuzzleKey(k => k + 1)
      setLoading(false)
      preFetch() // start loading the one after
      return
    }

    // 2. Fetch from Lichess — retry up to 3 times on duplicate
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch("/api/lichess-puzzle")
        if (res.ok) {
          const lp = await res.json() as Puzzle
          if (lp.fen_position && lp.solution_moves?.length && !usedIds.current.has(lp.id)) {
            usedIds.current.add(lp.id)
            setPuzzle(lp)
            setPuzzleKey(k => k + 1)
            setLoading(false)
            preFetch() // pre-load the next one while player solves this one
            return
          }
        }
      } catch { /* retry */ }
    }

    // 3. Fallback: quest_nodes with randomised order to avoid deterministic repeats
    const supabase = createClient()
    const ascending = Math.random() > 0.5
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (supabase.from("quest_nodes") as any)
      .select("id, fen_position, solution_moves, xp_reward")
      .not("fen_position", "is", null)
      .not("solution_moves", "is", null)
      .order("id", { ascending })
      .limit(30)

    const candidates = (rows ?? []).filter(
      (r: Puzzle) => r.fen_position && r.solution_moves?.length && !usedIds.current.has(r.id)
    )

    if (candidates.length === 0) {
      // Pool truly exhausted — end session gracefully rather than repeating
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase("done")
      setLoading(false)
      return
    }

    const r = candidates[Math.floor(Math.random() * candidates.length)] as Puzzle
    usedIds.current.add(r.id)
    setPuzzle(r)
    setPuzzleKey(k => k + 1)
    setLoading(false)
  }

  function startRush() {
    usedIds.current.clear()
    puzzleQueue.current = []
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
  const timerColor = timeLeft <= 30 ? "#DC2626" : timeLeft <= 60 ? "#B45309" : "#1B5E35"
  const multiplier = combo >= 5 ? 3 : combo >= 3 ? 2 : 1

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 72 }}>
      <header style={{ background: "#1B5E35", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => router.back()} style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff", letterSpacing: "0.04em" }}>PUZZLE RUSH</span>
        </div>
        <div style={{ width: 48 }} />
      </header>

      <main style={{ maxWidth: 384, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Timer + score bar */}
        {phase !== "idle" && (
          <div className="cc-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontFamily: "monospace", fontSize: 32, fontWeight: 900, color: timerColor, letterSpacing: 2 }}>
                  {mins}:{secs.toString().padStart(2, "0")}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>time remaining</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 28, fontWeight: 900, color: "var(--gold)", fontFamily: "monospace" }}>{score}</p>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>score</p>
              </div>
            </div>

            {/* combo bar */}
            {phase === "playing" && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, transition: "transform 0.15s", transform: comboAnim ? "scale(1.3)" : "scale(1)" }}>
                  <span style={{ fontSize: 16 }}>🔥</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: "var(--text)", fontFamily: "monospace" }}>{combo}x</span>
                </div>
                <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (combo / 5) * 100)}%`,
                      height: "100%",
                      borderRadius: 99,
                      transition: "width 0.3s",
                      background: combo >= 5 ? "var(--gold)" : combo >= 3 ? "var(--orange)" : "var(--green)",
                    }}
                  />
                </div>
                {multiplier > 1 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", background: "rgba(180,83,9,0.1)", padding: "2px 8px", borderRadius: 99, border: "1px solid rgba(180,83,9,0.2)" }}>
                    ×{multiplier}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Idle state */}
        {phase === "idle" && (
          <div style={{ textAlign: "center", padding: "32px 0", display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <span style={{ fontSize: 72 }}>⚡</span>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text)", marginTop: 16, letterSpacing: "0.04em" }}>Puzzle Rush Arena</h1>
              <p style={{ color: "var(--text-3)", marginTop: 8, fontSize: 14 }}>Solve as many puzzles as you can in 3 minutes!</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { icon: "🔥", label: "Combo ×3", desc: "5+ in a row" },
                { icon: "⏱️", label: "+3 sec",   desc: "per solve"   },
                { icon: "🏆", label: "Top Score", desc: "beat your best" },
              ].map(c => (
                <div key={c.label} className="cc-card" style={{ padding: 12, textAlign: "center" }}>
                  <span style={{ fontSize: 24 }}>{c.icon}</span>
                  <p style={{ color: "var(--text)", fontSize: 11, fontWeight: 700, marginTop: 6 }}>{c.label}</p>
                  <p style={{ color: "var(--text-3)", fontSize: 10, marginTop: 2 }}>{c.desc}</p>
                </div>
              ))}
            </div>
            <button
              onClick={startRush}
              className="cc-btn-primary" style={{ fontSize: 16, fontWeight: 800, borderRadius: 16 }}
            >
              ⚡ Start Rush!
            </button>
          </div>
        )}

        {/* Playing state */}
        {phase === "playing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loading || !puzzle ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
                <div style={{ width: 32, height: 32, border: "4px solid var(--gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "cc-spin 0.8s linear infinite" }} />
              </div>
            ) : (
              <>
                <div className="cc-card" style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <ChessBoard
                    key={puzzleKey}
                    fen={puzzle.fen_position}
                    solutionMoves={puzzle.solution_moves}
                    themeId={themeId}
                    pieceSetId={pieceSetId}
                    flipped={puzzle.fen_position.split(" ")[1] === "b"}
                    onSolve={handleSolve}
                    onCaptureSuccess={() => {}}
                    onNodeCleared={() => {}}
                  />
                </div>
                <button
                  onClick={handleSkip}
                  className="cc-btn-ghost" style={{ width: "100%", fontSize: 13, borderRadius: 12 }}
                >
                  Skip (lose combo)
                </button>
              </>
            )}
          </div>
        )}

        {/* Done state */}
        {phase === "done" && (
          <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <span style={{ fontSize: 64 }}>🏆</span>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--text)", marginTop: 12, letterSpacing: "0.04em" }}>TIME&apos;S UP!</h2>
            </div>
            <div className="cc-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Final Score",    value: score,           color: "var(--gold)"   },
                { label: "Puzzles Solved", value: solved,          color: "var(--green)"  },
                { label: "Skipped",        value: failed,          color: "var(--red)"    },
                { label: "Best Combo",     value: `${bestCombo}x`, color: "var(--orange)" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--text-3)" }}>{s.label}</span>
                  <span style={{ fontWeight: 900, fontSize: 20, fontFamily: "monospace", color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={startRush}
                className="cc-btn-primary" style={{ flex: 1, fontSize: 14, fontWeight: 700, borderRadius: 12 }}
              >
                ⚡ Play Again
              </button>
              <button
                onClick={() => router.push("/quests")}
                className="cc-btn-ghost" style={{ flex: 1, fontSize: 13, borderRadius: 12 }}
              >
                Quest Map
              </button>
            </div>
          </div>
        )}

        {/* Stats row (visible when playing/done) */}
        {phase !== "idle" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="cc-card" style={{ padding: 12, textAlign: "center" }}>
              <p style={{ fontSize: 24, fontWeight: 900, color: "var(--green)", fontFamily: "monospace" }}>{solved}</p>
              <p style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Solved</p>
            </div>
            <div className="cc-card" style={{ padding: 12, textAlign: "center" }}>
              <p style={{ fontSize: 24, fontWeight: 900, color: "var(--red)", fontFamily: "monospace" }}>{failed}</p>
              <p style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Skipped</p>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
