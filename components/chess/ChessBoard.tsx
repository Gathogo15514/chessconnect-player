"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { BOARD_THEMES, PIECE_SETS, PIECE_UNICODE, FILES, ThemeId, PieceSetId } from "./themes"
import { playMoveSound, playCaptureSound, playSolveSound } from "@/lib/chess-sounds"

const SQUARE_SIZE = 44
const BOARD_PX = SQUARE_SIZE * 8

const PIECE_TO_LICHESS: Record<string, string> = {
  K: "wK", Q: "wQ", R: "wR", B: "wB", N: "wN", P: "wP",
  k: "bK", q: "bQ", r: "bR", b: "bB", n: "bN", p: "bP",
}

type Props = {
  fen: string
  solutionMoves: string[]
  themeId: ThemeId
  pieceSetId: PieceSetId
  onSolve?: () => void
  onMove?: (move: string) => void
  onCaptureSuccess?: () => void
  onNodeCleared?: () => void
  flipped?: boolean
  freePlay?: boolean
  onFreeMove?: (move: { from: string; to: string; promotion?: string }) => void
}

type Particle = {
  x: number; y: number
  vx: number; vy: number
  alpha: number; color: string; radius: number
}

type MoveEntry = { symbol: string; from: string; to: string; isPlayer: boolean }

// ── FEN parsing ──────────────────────────────────────────────────────────────

function fenToBoard(fen: string): (string | null)[][] {
  const board: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null))
  const rows = fen.split(" ")[0].split("/")
  rows.forEach((row, r) => {
    let c = 0
    for (const ch of row) {
      if (/\d/.test(ch)) { c += parseInt(ch) } else { board[r][c++] = ch }
    }
  })
  return board
}

function applyMove(board: (string | null)[][], move: string): (string | null)[][] {
  const next = board.map(r => [...r])
  const fc = FILES.indexOf(move[0])
  const fr = 8 - parseInt(move[1])
  const tc = FILES.indexOf(move[2])
  const tr = 8 - parseInt(move[3])
  const piece = next[fr][fc]
  if (!piece) return next

  const promoChar = move[4]
  next[tr][tc] = promoChar
    ? (piece === piece.toUpperCase() ? promoChar.toUpperCase() : promoChar.toLowerCase())
    : piece
  next[fr][fc] = null

  // En passant: pawn moves diagonally to an empty square
  if ((piece === "P" || piece === "p") && fc !== tc && board[tr][tc] === null) {
    next[fr][tc] = null  // captured pawn on same rank as mover, destination file
  }

  // Castling
  if (piece === "K" && fc === 4) {
    if (tc === 6) { next[7][5] = "R"; next[7][7] = null }
    if (tc === 2) { next[7][3] = "R"; next[7][0] = null }
  }
  if (piece === "k" && fc === 4) {
    if (tc === 6) { next[0][5] = "r"; next[0][7] = null }
    if (tc === 2) { next[0][3] = "r"; next[0][0] = null }
  }

  // Auto-queen fallback if no explicit promo char
  if (!promoChar) {
    if (piece === "P" && tr === 0) next[tr][tc] = "Q"
    if (piece === "p" && tr === 7) next[tr][tc] = "q"
  }

  return next
}

// ── Particle helpers ─────────────────────────────────────────────────────────

function spawnBurst(cx: number, cy: number, color: string): Particle[] {
  return Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2
    const speed = 2.5 + Math.random() * 2
    return { x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, alpha: 1, color, radius: 3 + Math.random() * 3 }
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ChessBoard({
  fen,
  solutionMoves,
  themeId,
  pieceSetId,
  onSolve,
  onMove,
  onCaptureSuccess,
  onNodeCleared,
  flipped = false,
  freePlay = false,
  onFreeMove,
}: Props) {
  const theme    = BOARD_THEMES[themeId]
  const pieceSet = PIECE_SETS[pieceSetId]

  const [board,         setBoard]         = useState<(string | null)[][]>(() => fenToBoard(fen))
  const [moveIdx,       setMoveIdx]       = useState(0)
  const [selected,      setSelected]      = useState<[number, number] | null>(null)
  const [lastMove,      setLastMove]      = useState<string | null>(null)
  const [hint,          setHint]          = useState(false)
  const [msg,           setMsg]           = useState<string | null>(null)
  const [solved,        setSolved]        = useState(false)
  const [playerTurn,    setPlayerTurn]    = useState(true)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [revealed,      setRevealed]      = useState(false)
  const [revealSquares, setRevealSquares] = useState<{ from: [number,number]; to: [number,number] } | null>(null)
  const [moveLog,       setMoveLog]       = useState<MoveEntry[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const rafRef    = useRef<number>(0)

  // Whose turn it is from FEN — determines which side the player controls
  const fenTurn      = fen.split(" ")[1] as "w" | "b"
  const playerColor: "w" | "b" = fenTurn

  useEffect(() => {
    setBoard(fenToBoard(fen))
    setMoveIdx(0)
    setSelected(null)
    setLastMove(null)
    setHint(false)
    setMsg(null)
    setSolved(false)
    setPlayerTurn(true)
    setWrongAttempts(0)
    setRevealed(false)
    setRevealSquares(null)
    setMoveLog([])
  }, [fen, solutionMoves.join(",")])

  // Canvas particle loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    function tick() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      particles.current = particles.current.filter(p => p.alpha > 0.02)
      for (const p of particles.current) {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
        p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.alpha -= 0.033
      }
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const burst = useCallback((col: number, row: number, color: string) => {
    const cx = (flipped ? 7 - col : col) * SQUARE_SIZE + SQUARE_SIZE / 2
    const cy = (flipped ? 7 - row : row) * SQUARE_SIZE + SQUARE_SIZE / 2
    particles.current.push(...spawnBurst(cx, cy, color))
  }, [flipped])

  function squareCoords(col: number, row: number): [number, number] {
    return flipped ? [7 - col, 7 - row] : [col, row]
  }

  // Apply a move and log it
  function applyAndLog(
    currentBoard: (string | null)[][],
    move: string,
    isPlayer: boolean
  ): (string | null)[][] {
    const fc = FILES.indexOf(move[0])
    const fr = 8 - parseInt(move[1])
    const piece = currentBoard[fr]?.[fc]
    const symbol = piece ? (PIECE_UNICODE[piece] ?? piece) : "?"
    setMoveLog(prev => [...prev, { symbol, from: move.slice(0, 2), to: move.slice(2, 4), isPlayer }])
    return applyMove(currentBoard, move)
  }

  // Reveal the current solution move visually, then auto-play it
  function handleReveal() {
    if (moveIdx >= solutionMoves.length) return
    setRevealed(true)
    const move = solutionMoves[moveIdx]
    const fc = FILES.indexOf(move[0])
    const fr = 8 - parseInt(move[1])
    const tc = FILES.indexOf(move[2])
    const tr = 8 - parseInt(move[3])
    setRevealSquares({ from: [fc, fr], to: [tc, tr] })
    setMsg("💡 Answer revealed — watch the move!")

    // Auto-play the player's move after 2s
    setTimeout(() => {
      const nextBoard = applyAndLog(board, move, true)
      const isCapture = board[tr][tc] !== null
      setBoard(nextBoard)
      setLastMove(move)
      setSelected(null)
      setRevealSquares(null)
      if (isCapture) { burst(tc, tr, pieceSet.burstColor); playCaptureSound(themeId) }
      else { burst(tc, tr, theme.hintColor); playMoveSound(themeId) }

      const nextIdx = moveIdx + 1
      if (nextIdx >= solutionMoves.length) {
        setSolved(true); setMsg("✅ Solution shown — study this pattern!")
        playSolveSound(themeId); onSolve?.(); onNodeCleared?.()
        return
      }

      // Auto-play opponent move
      setPlayerTurn(false)
      setMoveIdx(nextIdx)
      setTimeout(() => {
        const oppMove = solutionMoves[nextIdx]
        const oppTc = FILES.indexOf(oppMove[2])
        const oppTr = 8 - parseInt(oppMove[3])
        const oppCapture = nextBoard[oppTr][oppTc] !== null
        const oppBoard = applyAndLog(nextBoard, oppMove, false)
        setBoard(oppBoard)
        setLastMove(oppMove)
        setMoveIdx(nextIdx + 1)
        if (oppCapture) { burst(oppTc, oppTr, "#ff4444"); playCaptureSound(themeId) }
        else playMoveSound(themeId)
        if (nextIdx + 1 >= solutionMoves.length) {
          setSolved(true); setMsg("✅ Solution shown — study this pattern!")
          playSolveSound(themeId); onSolve?.(); onNodeCleared?.()
        } else {
          setPlayerTurn(true)
          setRevealed(false)  // let player try the next move
          setMsg("▶ Try the next move!")
        }
      }, 800)
    }, 2000)
  }

  function handleSquareClick(dispCol: number, dispRow: number) {
    if (solved || revealed) return
    if (!freePlay && !playerTurn) return

    const [col, row] = squareCoords(dispCol, dispRow)

    if (selected === null) {
      const piece = board[row][col]
      if (!piece) return
      const isWhite = piece === piece.toUpperCase()
      if ((playerColor === "w" && !isWhite) || (playerColor === "b" && isWhite)) return
      setSelected([col, row])
      setHint(false)
      setMsg(null)
    } else {
      const [sc, sr] = selected
      if (sc === col && sr === row) { setSelected(null); return }

      const attempted = `${FILES[sc]}${8 - sr}${FILES[col]}${8 - row}`

      // ── Free play ────────────────────────────────────────────────────────────
      if (freePlay) {
        const isCapture = board[row][col] !== null
        const nextBoard = applyMove(board, attempted)
        setBoard(nextBoard)
        setLastMove(attempted)
        setSelected(null)
        if (isCapture) { burst(col, row, pieceSet.burstColor); playCaptureSound(themeId) }
        else { burst(col, row, theme.hintColor); playMoveSound(themeId) }
        onFreeMove?.({ from: attempted.slice(0, 2), to: attempted.slice(2, 4) })
        return
      }

      // ── Puzzle mode ──────────────────────────────────────────────────────────
      const expected = solutionMoves[moveIdx]

      if (!expected || !expected.startsWith(attempted)) {
        const newCount = wrongAttempts + 1
        setWrongAttempts(newCount)
        setSelected(null)
        if (newCount >= 3) {
          setMsg("❌ 3 wrong moves — tap 🔓 Reveal Answer below to see the solution")
        } else {
          setMsg(`❌ Wrong move — try again! (${3 - newCount} hint${3 - newCount === 1 ? "" : "s"} left)`)
        }
        return
      }

      // Correct move
      const isCapture = board[row][col] !== null
      const nextBoard = applyAndLog(board, expected, true)
      setBoard(nextBoard)
      setLastMove(expected)
      setSelected(null)
      setMsg(null)
      setWrongAttempts(0)

      if (isCapture) { burst(col, row, pieceSet.burstColor); playCaptureSound(themeId); onCaptureSuccess?.() }
      else { burst(col, row, theme.hintColor); playMoveSound(themeId) }
      onMove?.(expected)

      const nextIdx = moveIdx + 1
      if (nextIdx >= solutionMoves.length) {
        setSolved(true)
        setMsg("🎉 Brilliant! Puzzle cleared!")
        playSolveSound(themeId); onSolve?.(); onNodeCleared?.()
        return
      }

      // Auto-play opponent response
      setPlayerTurn(false)
      setMoveIdx(nextIdx)
      setTimeout(() => {
        const oppMove = solutionMoves[nextIdx]
        const oppTc = FILES.indexOf(oppMove[2])
        const oppTr = 8 - parseInt(oppMove[3])
        const oppCapture = nextBoard[oppTr][oppTc] !== null
        const oppBoard = applyAndLog(nextBoard, oppMove, false)
        setBoard(oppBoard)
        setLastMove(oppMove)
        setMoveIdx(nextIdx + 1)
        if (oppCapture) { burst(oppTc, oppTr, "#ff4444"); playCaptureSound(themeId) }
        else playMoveSound(themeId)
        if (nextIdx + 1 >= solutionMoves.length) {
          setSolved(true); setMsg("🎉 Brilliant! Puzzle cleared!")
          playSolveSound(themeId); onSolve?.(); onNodeCleared?.()
        } else {
          setPlayerTurn(true)
        }
      }, 700)
    }
  }

  function showHint() {
    if (solved || moveIdx >= solutionMoves.length || !playerTurn) return
    const move = solutionMoves[moveIdx]
    const fc = FILES.indexOf(move[0])
    const fr = 8 - parseInt(move[1])
    setSelected([fc, fr])
    setHint(true)
    setMsg("💡 Hint — find the best continuation from this piece!")
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const squares: React.ReactNode[] = []

  for (let dispRow = 0; dispRow < 8; dispRow++) {
    for (let dispCol = 0; dispCol < 8; dispCol++) {
      const [col, row] = squareCoords(dispCol, dispRow)
      const piece = board[row][col]
      const isLight = (col + row) % 2 === 0
      const isSelected = selected !== null && selected[0] === col && selected[1] === row
      const isLastMove = lastMove !== null && (
        (FILES[col] === lastMove[0] && String(8 - row) === lastMove[1]) ||
        (FILES[col] === lastMove[2] && String(8 - row) === lastMove[3])
      )
      const isRevealFrom = revealSquares !== null && revealSquares.from[0] === col && revealSquares.from[1] === row
      const isRevealTo   = revealSquares !== null && revealSquares.to[0]   === col && revealSquares.to[1]   === row

      const baseColor = isLight ? theme.lightSquare : theme.darkSquare
      let bgColor = baseColor
      if (isRevealFrom || isRevealTo) bgColor = "rgba(255,100,0,0.6)"
      else if (isSelected) bgColor = theme.selectedSquare
      else if (isLastMove) bgColor = theme.lastMoveSquare

      const isHintDest = hint && moveIdx < solutionMoves.length &&
        FILES[col] === solutionMoves[moveIdx][2] &&
        String(8 - row) === solutionMoves[moveIdx][3]

      const isWhitePiece = piece && piece === piece.toUpperCase()
      const pieceColor   = piece ? (isWhitePiece ? pieceSet.whitePiece : pieceSet.blackPiece) : undefined
      const pieceShadow  = piece ? (isWhitePiece ? pieceSet.whiteShadow : pieceSet.blackShadow) : undefined
      const lichessFile  = piece ? PIECE_TO_LICHESS[piece] : undefined

      squares.push(
        <div
          key={`${dispCol}-${dispRow}`}
          onClick={() => handleSquareClick(dispCol, dispRow)}
          style={{
            position: "absolute",
            left: dispCol * SQUARE_SIZE, top: dispRow * SQUARE_SIZE,
            width: SQUARE_SIZE, height: SQUARE_SIZE,
            background: bgColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: solved ? "default" : "pointer",
            userSelect: "none", boxSizing: "border-box",
          }}
        >
          {isHintDest && !piece && (
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: theme.hintColor + "99", border: `2px solid ${theme.hintColor}` }} />
          )}
          {isHintDest && piece && (
            <div style={{ position: "absolute", inset: 3, borderRadius: 4, border: `2px solid ${theme.hintColor}`, boxShadow: `0 0 8px ${theme.hintColor}88`, pointerEvents: "none" }} />
          )}
          {piece && (
            pieceSet.imageBase && lichessFile ? (
              <img
                src={`${pieceSet.imageBase}${lichessFile}.svg`}
                alt={piece} draggable={false}
                style={{
                  width: SQUARE_SIZE - 4, height: SQUARE_SIZE - 4,
                  objectFit: "contain", pointerEvents: "none", position: "relative", zIndex: 1,
                  filter: isSelected ? "drop-shadow(0 0 4px rgba(255,215,0,0.9))" : undefined,
                }}
              />
            ) : (
              <span style={{ fontSize: 30, lineHeight: 1, color: pieceColor, textShadow: pieceShadow, position: "relative", zIndex: 1 }}>
                {PIECE_UNICODE[piece] ?? piece}
              </span>
            )
          )}
          {dispCol === 0 && (
            <span style={{ position: "absolute", top: 2, left: 2, fontSize: 9, fontWeight: 700, color: isLight ? theme.darkSquare : theme.lightSquare, opacity: 0.85, lineHeight: 1, pointerEvents: "none" }}>
              {flipped ? row + 1 : 8 - row}
            </span>
          )}
          {dispRow === 7 && (
            <span style={{ position: "absolute", bottom: 2, right: 3, fontSize: 9, fontWeight: 700, color: isLight ? theme.darkSquare : theme.lightSquare, opacity: 0.85, lineHeight: 1, pointerEvents: "none" }}>
              {FILES[col]}
            </span>
          )}
        </div>
      )
    }
  }

  const toMoveLabel = playerColor === "w" ? "White to move" : "Black to move"
  const toMoveColor = playerColor === "w" ? "#f0d9b5" : "#2d2d2d"
  const toMoveBorder = playerColor === "w" ? "#c8a450" : "#888"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>

      {/* ── Who to move badge ── */}
      {!freePlay && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: toMoveColor, border: `2px solid ${toMoveBorder}`, boxShadow: playerColor === "w" ? "0 0 6px rgba(240,217,181,0.6)" : "none" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: playerColor === "w" ? "#f0d9b5" : "#94a3b8", letterSpacing: "0.05em" }}>
            {toMoveLabel}
          </span>
          {!playerTurn && !solved && (
            <span style={{ fontSize: 10, color: "#64748b", marginLeft: 4 }}>opponent thinking…</span>
          )}
        </div>
      )}

      {/* ── Board frame ── */}
      <div style={{ padding: 4, background: "#3d1a00", borderRadius: 8, boxShadow: "0 12px 48px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)" }}>
        <div style={{ position: "relative", width: BOARD_PX, height: BOARD_PX, border: `2px solid ${theme.border}`, borderRadius: 4, overflow: "hidden", boxShadow: theme.glow ?? "0 4px 24px rgba(0,0,0,0.4)" }}>
          {squares}
          <canvas ref={canvasRef} width={BOARD_PX} height={BOARD_PX} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }} />
        </div>
      </div>

      {/* ── Feedback message ── */}
      {msg && (
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: solved ? "#4ade80" : msg.startsWith("❌") ? "#f87171" : "#fbbf24",
          textAlign: "center",
          padding: "6px 16px",
          background: solved ? "rgba(16,185,129,0.1)" : msg.startsWith("❌") ? "rgba(248,113,113,0.08)" : "rgba(251,191,36,0.08)",
          border: `1px solid ${solved ? "rgba(16,185,129,0.25)" : msg.startsWith("❌") ? "rgba(248,113,113,0.2)" : "rgba(251,191,36,0.2)"}`,
          borderRadius: 10, maxWidth: BOARD_PX,
        }}>
          {msg}
        </div>
      )}

      {/* ── Solution move log (shown after solving) ── */}
      {solved && moveLog.length > 0 && (
        <div style={{ maxWidth: BOARD_PX, width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Solution line</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
            {moveLog.map((m, i) => (
              <span key={i} style={{
                fontSize: 12, fontWeight: 700,
                color: m.isPlayer ? "#4ade80" : "#f87171",
                background: m.isPlayer ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${m.isPlayer ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                borderRadius: 6, padding: "2px 6px",
              }}>
                {m.symbol}{m.from}→{m.to}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      {!solved && !freePlay && (
        <div style={{ display: "flex", gap: 8, maxWidth: BOARD_PX, width: "100%" }}>
          {playerTurn && !revealed && (
            <button onClick={showHint} style={{ flex: 1, fontSize: 12, padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.hintColor}44`, borderRadius: 8, color: theme.hintColor, cursor: "pointer" }}>
              💡 Show Hint
            </button>
          )}
          {wrongAttempts >= 3 && !revealed && (
            <button onClick={handleReveal} style={{ flex: 1, fontSize: 12, padding: "6px 10px", background: "rgba(255,100,0,0.1)", border: "1px solid rgba(255,100,0,0.3)", borderRadius: 8, color: "#fb923c", cursor: "pointer", fontWeight: 700 }}>
              🔓 Reveal Answer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
