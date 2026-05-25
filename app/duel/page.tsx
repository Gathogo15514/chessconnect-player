"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter }    from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { BottomNav }    from "@/components/BottomNav"
import ChessBoard       from "@/components/chess/ChessBoard"
import type { ThemeId, PieceSetId } from "@/components/chess/themes"
import { Chess }        from "chess.js"

// ── Types ─────────────────────────────────────────────────────────────────────
type GuildMate = {
  id:       string
  name:     string
  rating:   number | null
  level:    number
  avatar?:  string | null
}

type DuelState = "lobby" | "playing" | "finished"

type Move = { from: string; to: string; promotion?: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const TIME_OPTIONS = [1, 3, 5, 10] // minutes
const INITIAL_FEN  = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

// ── Clock component ───────────────────────────────────────────────────────────
function Clock({ secs, active, color }: { secs: number; active: boolean; color: "white" | "black" }) {
  const m  = Math.floor(secs / 60)
  const s  = secs % 60
  const lo = secs <= 10
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "100%", padding: "10px 16px", borderRadius: 12,
      background: active ? (color === "white" ? "#f8fafc" : "#1e293b") : "rgba(0,0,0,0.1)",
      border: active ? `2px solid ${lo ? "#ef4444" : "#10b981"}` : "2px solid transparent",
      boxShadow: active ? `0 0 12px ${lo ? "#ef444466" : "#10b98133"}` : "none",
      transition: "all 0.3s",
    }}>
      <span style={{
        fontFamily: "monospace", fontSize: 32, fontWeight: 700,
        color: active ? (lo ? "#ef4444" : color === "white" ? "#1e293b" : "#f8fafc") : "#6b7280",
        letterSpacing: 2,
      }}>
        {m}:{s.toString().padStart(2, "0")}
      </span>
    </div>
  )
}

// ── Result banner ─────────────────────────────────────────────────────────────
function ResultBanner({ result, myColor, onRematch, onExit }: {
  result:   "win" | "loss" | "draw"
  myColor:  "white" | "black"
  onRematch: () => void
  onExit:    () => void
}) {
  const [emoji, label, bg] = result === "win"
    ? ["🏆", "You Win!", "linear-gradient(135deg, #fef3c7, #fde68a)"]
    : result === "loss"
    ? ["💀", "Defeated!", "linear-gradient(135deg, #fee2e2, #fecaca)"]
    : ["🤝", "Draw!", "linear-gradient(135deg, #e0e7ff, #c7d2fe)"]

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)",
    }}>
      <div style={{
        background: bg, borderRadius: 24, padding: "32px 24px",
        textAlign: "center", maxWidth: 280, width: "90%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontSize: 64 }}>{emoji}</div>
        <p style={{ fontSize: 24, fontWeight: 800, marginTop: 8,
          color: result === "win" ? "#92400e" : result === "loss" ? "#b91c1c" : "#3730a3" }}>
          {label}
        </p>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          You played as {myColor}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onExit}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
              background: "#f1f5f9", color: "#475569", fontWeight: 700, cursor: "pointer" }}>
            Exit
          </button>
          <button onClick={onRematch}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
              background: "#0f172a", color: "#10b981", fontWeight: 700, cursor: "pointer" }}>
            Rematch
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DuelPage() {
  const router = useRouter()

  // Player info
  const [myId,      setMyId]      = useState<string | null>(null)
  const [myName,    setMyName]    = useState("You")
  const [myRating,  setMyRating]  = useState<number | null>(null)
  const [themeId,   setThemeId]   = useState<ThemeId>("classic")
  const [pieceSetId,setPieceSetId]= useState<PieceSetId>("standard")

  // Guild mates
  const [guildMates, setGuildMates] = useState<GuildMate[]>([])
  const [opponent,   setOpponent]   = useState<GuildMate | null>(null)
  const [loadingMates, setLoadingMates] = useState(true)

  // Duel config
  const [timeMin,   setTimeMin]   = useState(3)
  const [myColor,   setMyColor]   = useState<"white" | "black">("white")

  // Game state
  const [duelState, setDuelState] = useState<DuelState>("lobby")
  const [chess,     setChess]     = useState(() => new Chess())
  const [fen,       setFen]       = useState(INITIAL_FEN)
  const [whiteTime, setWhiteTime] = useState(3 * 60)
  const [blackTime, setBlackTime] = useState(3 * 60)
  const [result,    setResult]    = useState<"win" | "loss" | "draw" | null>(null)
  const [moveHistory, setMoveHistory] = useState<string[]>([])

  // Timers
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const aiThinking = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }
      const uid = session.user.id

      const [profileRes, playerRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("profiles") as any).select("full_name").eq("id", uid).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("players") as any)
          .select("id, current_rating, school_id, club_id")
          .eq("profile_id", uid).maybeSingle(),
      ])

      const pl = playerRes.data
      if (!pl) { setLoadingMates(false); return }

      setMyId(pl.id)
      setMyName(profileRes.data?.full_name?.split(" ")[0] ?? "You")
      setMyRating(pl.current_rating ?? null)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gpRes = await (supabase.from("player_game_profiles") as any)
        .select("board_theme, piece_set").eq("player_id", pl.id).maybeSingle()
      if (gpRes.data?.board_theme) setThemeId(gpRes.data.board_theme as ThemeId)
      if (gpRes.data?.piece_set)   setPieceSetId(gpRes.data.piece_set as PieceSetId)

      // Fetch guild mates (same school or club)
      const filters = []
      if (pl.school_id) filters.push(`school_id.eq.${pl.school_id}`)
      if (pl.club_id)   filters.push(`club_id.eq.${pl.club_id}`)
      const orFilter = filters.length
        ? filters.join(",")
        : "id.eq.00000000-0000-0000-0000-000000000000"

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matesRes = await (supabase.from("players") as any)
        .select("id, current_rating, player_game_profiles(current_level, avatar_id), profiles(full_name)")
        .or(orFilter)
        .neq("id", pl.id)
        .limit(20)

      const mates: GuildMate[] = (matesRes.data ?? []).map((m: {
        id: string
        current_rating: number | null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        player_game_profiles: any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profiles: any
      }) => ({
        id:     m.id,
        name:   m.profiles?.full_name?.split(" ")[0] ?? "Player",
        rating: m.current_rating,
        level:  m.player_game_profiles?.current_level ?? 1,
        avatar: m.player_game_profiles?.avatar_id ?? null,
      }))

      setGuildMates(mates)
      setLoadingMates(false)
    })
  }, [router])

  // ── Clock tick ──────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startTimer = useCallback((turn: "w" | "b") => {
    stopTimer()
    timerRef.current = setInterval(() => {
      if (turn === "w") {
        setWhiteTime(t => {
          if (t <= 1) { stopTimer(); endGame("timeout", "w"); return 0 }
          return t - 1
        })
      } else {
        setBlackTime(t => {
          if (t <= 1) { stopTimer(); endGame("timeout", "b"); return 0 }
          return t - 1
        })
      }
    }, 1000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer])

  useEffect(() => () => stopTimer(), [stopTimer])

  // ── End game ─────────────────────────────────────────────────────────────────
  function endGame(reason: "checkmate" | "stalemate" | "timeout" | "draw", loserTurn?: "w" | "b") {
    stopTimer()
    if (reason === "stalemate" || reason === "draw") {
      setResult("draw")
    } else if (reason === "timeout") {
      const loserIsWhite = loserTurn === "w"
      const iLose = (loserIsWhite && myColor === "white") || (!loserIsWhite && myColor === "black")
      setResult(iLose ? "loss" : "win")
    } else {
      // checkmate: the side that just moved won
      const winnerIsWhite = chess.turn() === "b" // after checkmate, turn flips
      const iWin = (winnerIsWhite && myColor === "white") || (!winnerIsWhite && myColor === "black")
      setResult(iWin ? "win" : "loss")
    }
    setDuelState("finished")
  }

  // ── AI opponent move ──────────────────────────────────────────────────────────
  const makeAiMove = useCallback(async (currentChess: Chess, currentFen: string) => {
    if (aiThinking.current) return
    aiThinking.current = true
    try {
      const res = await fetch("/api/ai-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: currentFen }),
      })
      const data = await res.json()
      if (data.uci) {
        const from = data.uci.slice(0, 2) as string
        const to   = data.uci.slice(2, 4) as string
        const promo = data.uci[4] as string | undefined
        const newChess = new Chess(currentChess.fen())
        const move = newChess.move({ from, to, promotion: promo ?? "q" })
        if (move) {
          const newFen = newChess.fen()
          setChess(newChess)
          setFen(newFen)
          setMoveHistory(h => [...h, move.san])
          const turn = newChess.turn()
          if (newChess.isCheckmate()) { endGame("checkmate"); return }
          if (newChess.isStalemate() || newChess.isDraw()) { endGame("draw"); return }
          startTimer(turn)
        }
      }
    } finally {
      aiThinking.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTimer])

  // ── Handle player move from ChessBoard ────────────────────────────────────────
  function handlePlayerMove(move: Move) {
    const newChess = new Chess(chess.fen())
    const result = newChess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })
    if (!result) return
    const newFen = newChess.fen()
    setChess(newChess)
    setFen(newFen)
    setMoveHistory(h => [...h, result.san])

    if (newChess.isCheckmate()) { endGame("checkmate"); return }
    if (newChess.isStalemate() || newChess.isDraw()) { endGame("draw"); return }

    const turn = newChess.turn()
    // If opponent is AI, trigger AI move; else start opponent's clock
    if (!opponent) {
      startTimer(turn)
      makeAiMove(newChess, newFen)
    } else {
      startTimer(turn)
    }
  }

  // ── Start duel ────────────────────────────────────────────────────────────────
  function startDuel() {
    const totalSecs = timeMin * 60
    setWhiteTime(totalSecs)
    setBlackTime(totalSecs)
    const newChess = new Chess()
    setChess(newChess)
    setFen(INITIAL_FEN)
    setMoveHistory([])
    setResult(null)
    setDuelState("playing")
    aiThinking.current = false
    startTimer("w")

    // If player is black, AI makes first move immediately
    if (myColor === "black" && !opponent) {
      setTimeout(() => makeAiMove(newChess, INITIAL_FEN), 800)
    }
  }

  function resetLobby() {
    stopTimer()
    setDuelState("lobby")
    setChess(new Chess())
    setFen(INITIAL_FEN)
    setMoveHistory([])
    setResult(null)
    aiThinking.current = false
  }

  const isMyTurn = duelState === "playing" && (
    (chess.turn() === "w" && myColor === "white") ||
    (chess.turn() === "b" && myColor === "black")
  )

  // ── Render: Lobby ─────────────────────────────────────────────────────────────
  if (duelState === "lobby") {
    return (
      <div className="min-h-screen pb-20" style={{ background: "#0f172a" }}>
        <header style={{ background: "#0f172a", borderBottom: "1px solid rgba(16,185,129,0.15)" }}
          className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚔️</span>
            <span className="font-bold text-lg" style={{ color: "#10b981" }}>Friendly Duel</span>
          </div>
          <button onClick={() => router.back()}
            className="text-sm" style={{ color: "rgba(16,185,129,0.6)" }}>← Back</button>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
          {/* VS banner */}
          <div style={{
            background: "linear-gradient(135deg, #1e293b, #0f2a1a)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 20, padding: "20px 24px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 36 }}>🧑‍💻</div>
              <p style={{ color: "#f8fafc", fontWeight: 700, marginTop: 4 }}>{myName}</p>
              {myRating && <p style={{ color: "#6b7280", fontSize: 12 }}>Rating {myRating}</p>}
            </div>
            <div style={{ fontSize: 28, color: "#f59e0b", fontWeight: 900 }}>VS</div>
            <div style={{ textAlign: "center", flex: 1 }}>
              {opponent ? (
                <>
                  <div style={{ fontSize: 36 }}>🤺</div>
                  <p style={{ color: "#f8fafc", fontWeight: 700, marginTop: 4 }}>{opponent.name}</p>
                  {opponent.rating && <p style={{ color: "#6b7280", fontSize: 12 }}>Rating {opponent.rating}</p>}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36 }}>🤖</div>
                  <p style={{ color: "#94a3b8", fontWeight: 700, marginTop: 4 }}>AI Sparring</p>
                  <p style={{ color: "#6b7280", fontSize: 12 }}>Claude Haiku</p>
                </>
              )}
            </div>
          </div>

          {/* Time control */}
          <div style={{
            background: "#1e293b", borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)", padding: 16,
          }}>
            <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Time Control
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {TIME_OPTIONS.map(t => (
                <button key={t} onClick={() => setTimeMin(t)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
                    cursor: "pointer", fontWeight: 700, fontSize: 14, transition: "all 0.2s",
                    background: timeMin === t ? "#10b981" : "rgba(255,255,255,0.05)",
                    color: timeMin === t ? "#fff" : "#64748b",
                    boxShadow: timeMin === t ? "0 0 10px #10b98144" : "none",
                  }}>
                  {t}m
                </button>
              ))}
            </div>
          </div>

          {/* Color pick */}
          <div style={{
            background: "#1e293b", borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)", padding: 16,
          }}>
            <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Play As
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["white","black"] as const).map(c => (
                <button key={c} onClick={() => setMyColor(c)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    cursor: "pointer", fontWeight: 700, fontSize: 14, transition: "all 0.2s",
                    background: myColor === c
                      ? c === "white" ? "#f8fafc" : "#1e293b"
                      : "rgba(255,255,255,0.05)",
                    color: myColor === c
                      ? c === "white" ? "#1e293b" : "#f8fafc"
                      : "#64748b",
                    border: myColor === c
                      ? `2px solid ${c === "white" ? "#e2e8f0" : "#10b981"}`
                      : "2px solid transparent",
                  }}>
                  {c === "white" ? "⬜ White" : "⬛ Black"}
                </button>
              ))}
            </div>
          </div>

          {/* Opponent selector */}
          <div style={{
            background: "#1e293b", borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)", padding: 16,
          }}>
            <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Opponent
            </p>

            {/* AI option */}
            <button onClick={() => setOpponent(null)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10, border: "none",
                cursor: "pointer", marginBottom: 6, transition: "all 0.2s",
                background: !opponent ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
                outline: !opponent ? "1px solid rgba(16,185,129,0.4)" : "1px solid transparent",
              }}>
              <span style={{ fontSize: 24 }}>🤖</span>
              <div style={{ textAlign: "left" }}>
                <p style={{ color: "#f8fafc", fontWeight: 600, fontSize: 14 }}>AI Sparring Partner</p>
                <p style={{ color: "#64748b", fontSize: 11 }}>Powered by Claude Haiku</p>
              </div>
              {!opponent && <span style={{ marginLeft: "auto", color: "#10b981", fontSize: 16 }}>✓</span>}
            </button>

            {/* Guild mates */}
            {loadingMates ? (
              <div style={{ textAlign: "center", padding: 16 }}>
                <div style={{ width: 24, height: 24, border: "3px solid #10b981",
                  borderTopColor: "transparent", borderRadius: "50%",
                  animation: "spin 1s linear infinite", margin: "0 auto" }} />
              </div>
            ) : guildMates.length === 0 ? (
              <p style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "8px 0" }}>
                No guild mates found — play against the AI for now
              </p>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {guildMates.map(m => (
                  <button key={m.id} onClick={() => setOpponent(m)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", borderRadius: 10, border: "none",
                      cursor: "pointer", transition: "all 0.2s",
                      background: opponent?.id === m.id ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
                      outline: opponent?.id === m.id ? "1px solid rgba(16,185,129,0.4)" : "1px solid transparent",
                    }}>
                    <span style={{ fontSize: 22 }}>🤺</span>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <p style={{ color: "#f8fafc", fontWeight: 600, fontSize: 14 }}>{m.name}</p>
                      <p style={{ color: "#64748b", fontSize: 11 }}>
                        Lv.{m.level}{m.rating ? ` · Rating ${m.rating}` : ""}
                      </p>
                    </div>
                    {opponent?.id === m.id && <span style={{ color: "#10b981", fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start button */}
          <button onClick={startDuel} disabled={!myId}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 16, border: "none",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff", fontWeight: 800, fontSize: 18,
              cursor: myId ? "pointer" : "not-allowed",
              boxShadow: "0 4px 20px rgba(16,185,129,0.4)",
              letterSpacing: "0.02em",
            }}>
            ⚔️ Start Duel
          </button>

          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </main>

        <BottomNav />
      </div>
    )
  }

  // ── Render: Playing / Finished ────────────────────────────────────────────────
  const opponentName = opponent?.name ?? "AI"
  const myTimeLeft   = myColor === "white" ? whiteTime : blackTime
  const oppTimeLeft  = myColor === "white" ? blackTime : whiteTime
  const oppColor     = myColor === "white" ? "black" : "white"

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0f172a" }}>
      {result && (
        <ResultBanner
          result={result} myColor={myColor}
          onRematch={startDuel}
          onExit={resetLobby}
        />
      )}

      <header style={{ background: "#0f172a", borderBottom: "1px solid rgba(16,185,129,0.15)" }}
        className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚔️</span>
          <span className="font-bold" style={{ color: "#10b981" }}>
            {myName} <span style={{ color: "#f59e0b" }}>vs</span> {opponentName}
          </span>
        </div>
        <button onClick={resetLobby} style={{ color: "rgba(16,185,129,0.5)", fontSize: 13 }}>Resign</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* Opponent clock */}
        <Clock secs={oppTimeLeft} active={!isMyTurn && duelState === "playing"} color={oppColor} />

        {/* Board */}
        <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          <ChessBoard
            fen={fen}
            solutionMoves={[]}
            themeId={themeId}
            pieceSetId={pieceSetId}
            flipped={myColor === "black"}
            onSolve={() => {}}
            onCaptureSuccess={() => {}}
            onNodeCleared={() => {}}
            onFreeMove={isMyTurn ? handlePlayerMove : undefined}
            freePlay
          />
        </div>

        {/* My clock */}
        <Clock secs={myTimeLeft} active={isMyTurn && duelState === "playing"} color={myColor} />

        {/* Move list */}
        {moveHistory.length > 0 && (
          <div style={{
            background: "#1e293b", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "10px 12px", maxHeight: 80, overflowY: "auto",
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
              {moveHistory.map((m, i) => (
                <span key={i} style={{ fontSize: 12, color: i % 2 === 0 ? "#f8fafc" : "#94a3b8", fontFamily: "monospace" }}>
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}{m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {duelState === "playing" && (
          <p style={{ textAlign: "center", fontSize: 13, color: "#64748b" }}>
            {isMyTurn ? "Your turn" : `${opponentName} is thinking…`}
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
