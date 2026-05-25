"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { BOARD_THEMES, PIECE_SETS, PIECE_UNICODE, FILES, ThemeId, PieceSetId } from "./themes"
import { playMoveSound, playCaptureSound, playSolveSound } from "@/lib/chess-sounds"

const SQUARE_SIZE = 44
const BOARD_PX = SQUARE_SIZE * 8

type Props = {
  fen: string
  solutionMoves: string[]   // e.g. ["e2e4","e7e5","g1f3"]
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
  next[tr][tc] = piece
  next[fr][fc] = null
  // castling
  if (piece === "K" && fc === 4) {
    if (tc === 6) { next[7][5] = "R"; next[7][7] = null }
    if (tc === 2) { next[7][3] = "R"; next[7][0] = null }
  }
  if (piece === "k" && fc === 4) {
    if (tc === 6) { next[0][5] = "r"; next[0][7] = null }
    if (tc === 2) { next[0][3] = "r"; next[0][0] = null }
  }
  // pawn promotion — auto-queen
  if (piece === "P" && tr === 0) next[tr][tc] = "Q"
  if (piece === "p" && tr === 7) next[tr][tc] = "q"
  return next
}

// ── Particle helpers ─────────────────────────────────────────────────────────

function spawnBurst(cx: number, cy: number, color: string): Particle[] {
  return Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2
    const speed = 2.5 + Math.random() * 2
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color,
      radius: 3 + Math.random() * 3,
    }
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

  const [board, setBoard]       = useState<(string | null)[][]>(() => fenToBoard(fen))
  const [moveIdx, setMoveIdx]   = useState(0)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [lastMove, setLastMove] = useState<string | null>(null)
  const [hint, setHint]         = useState(false)
  const [msg, setMsg]           = useState<string | null>(null)
  const [solved, setSolved]     = useState(false)

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const particles  = useRef<Particle[]>([])
  const rafRef     = useRef<number>(0)

  // reset when fen / solution changes
  useEffect(() => {
    setBoard(fenToBoard(fen))
    setMoveIdx(0)
    setSelected(null)
    setLastMove(null)
    setHint(false)
    setMsg(null)
    setSolved(false)
  }, [fen, solutionMoves.join(",")])

  // canvas animation loop
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
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.92
        p.vy *= 0.92
        p.alpha -= 0.033
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

  // whose turn it is: in freePlay, read from FEN; in puzzle mode always white
  const fenTurn   = fen.split(" ")[1] as "w" | "b"
  const playerColor: "w" | "b" = freePlay ? fenTurn : "w"

  function squareCoords(col: number, row: number): [number, number] {
    return flipped ? [7 - col, 7 - row] : [col, row]
  }

  function handleSquareClick(dispCol: number, dispRow: number) {
    if (solved) return
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

      // ── Free play mode ────────────────────────────────────────────────────────
      if (freePlay) {
        const isCapture = board[row][col] !== null
        const nextBoard = applyMove(board, attempted)
        setBoard(nextBoard)
        setLastMove(attempted)
        setSelected(null)
        if (isCapture) {
          burst(col, row, pieceSet.burstColor)
          playCaptureSound(themeId)
        } else {
          burst(col, row, theme.hintColor)
          playMoveSound(themeId)
        }
        onFreeMove?.({ from: attempted.slice(0, 2), to: attempted.slice(2, 4) })
        return
      }

      // ── Puzzle mode ───────────────────────────────────────────────────────────
      const expected = solutionMoves[moveIdx]

      if (!expected || attempted !== expected) {
        setMsg("⚠️ Path Blocked! Try another vector!")
        setSelected(null)
        return
      }

      // correct move
      const isCapture = board[row][col] !== null
      const nextBoard = applyMove(board, attempted)

      setBoard(nextBoard)
      setLastMove(attempted)
      setSelected(null)
      setMsg(null)

      if (isCapture) {
        burst(col, row, pieceSet.burstColor)
        playCaptureSound(themeId)
        onCaptureSuccess?.()
      } else {
        burst(col, row, theme.hintColor)
        playMoveSound(themeId)
      }

      onMove?.(attempted)
      const nextIdx = moveIdx + 1

      if (nextIdx >= solutionMoves.length) {
        setSolved(true)
        setMsg("🎉 Puzzle Cleared! Excellent tactics!")
        playSolveSound(themeId)
        onSolve?.()
        onNodeCleared?.()
        return
      }

      // auto-play opponent move
      if (nextIdx < solutionMoves.length) {
        setTimeout(() => {
          const oppMove = solutionMoves[nextIdx]
          const oppBoard = applyMove(nextBoard, oppMove)
          const oppTc = FILES.indexOf(oppMove[2])
          const oppTr = 8 - parseInt(oppMove[3])
          const oppCapture = nextBoard[oppTr][oppTc] !== null
          setBoard(oppBoard)
          setLastMove(oppMove)
          setMoveIdx(nextIdx + 1)
          if (oppCapture) {
            burst(oppTc, oppTr, "#ff4444")
            playCaptureSound(themeId)
          } else {
            playMoveSound(themeId)
          }
          if (nextIdx + 1 >= solutionMoves.length) {
            setSolved(true)
            setMsg("🎉 Puzzle Cleared! Excellent tactics!")
            playSolveSound(themeId)
            onSolve?.()
            onNodeCleared?.()
          }
        }, 700)
        setMoveIdx(nextIdx) // will be overwritten after timeout but prevents double-click
      }
    }
  }

  function showHint() {
    if (solved || moveIdx >= solutionMoves.length) return
    const move = solutionMoves[moveIdx]
    const fc = FILES.indexOf(move[0])
    const fr = 8 - parseInt(move[1])
    setSelected([fc, fr])
    setHint(true)
    setMsg("💡 Hint activated — find the best continuation!")
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

      const baseColor = isLight ? theme.lightSquare : theme.darkSquare
      let bgColor = baseColor
      if (isSelected) bgColor = theme.selectedSquare
      else if (isLastMove) bgColor = theme.lastMoveSquare

      // hint dot
      const isHintDest = hint && moveIdx < solutionMoves.length &&
        FILES[col] === solutionMoves[moveIdx][2] &&
        String(8 - row) === solutionMoves[moveIdx][3]

      const isWhitePiece = piece && piece === piece.toUpperCase()
      const pieceColor   = piece ? (isWhitePiece ? pieceSet.whitePiece : pieceSet.blackPiece) : undefined
      const pieceShadow  = piece ? (isWhitePiece ? pieceSet.whiteShadow : pieceSet.blackShadow) : undefined

      squares.push(
        <div
          key={`${dispCol}-${dispRow}`}
          onClick={() => handleSquareClick(dispCol, dispRow)}
          style={{
            position: "absolute",
            left:   dispCol * SQUARE_SIZE,
            top:    dispRow * SQUARE_SIZE,
            width:  SQUARE_SIZE,
            height: SQUARE_SIZE,
            background: bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: solved ? "default" : "pointer",
            userSelect: "none",
            boxSizing: "border-box",
          }}
        >
          {/* hint ring */}
          {isHintDest && !piece && (
            <div style={{
              width: 14, height: 14, borderRadius: "50%",
              background: theme.hintColor + "99",
              border: `2px solid ${theme.hintColor}`,
            }} />
          )}
          {isHintDest && piece && (
            <div style={{
              position: "absolute", inset: 3, borderRadius: 4,
              border: `2px solid ${theme.hintColor}`,
              boxShadow: `0 0 8px ${theme.hintColor}88`,
              pointerEvents: "none",
            }} />
          )}
          {/* piece */}
          {piece && (
            <span style={{
              fontSize: 28,
              lineHeight: 1,
              color: pieceColor,
              textShadow: pieceShadow,
              position: "relative",
              zIndex: 1,
            }}>
              {PIECE_UNICODE[piece] ?? piece}
            </span>
          )}
          {/* rank/file labels */}
          {dispCol === 0 && (
            <span style={{
              position: "absolute", top: 1, left: 2,
              fontSize: 9, color: isLight ? theme.darkSquare : theme.lightSquare,
              opacity: 0.7, lineHeight: 1, pointerEvents: "none",
            }}>
              {8 - row}
            </span>
          )}
          {dispRow === 7 && (
            <span style={{
              position: "absolute", bottom: 1, right: 3,
              fontSize: 9, color: isLight ? theme.darkSquare : theme.lightSquare,
              opacity: 0.7, lineHeight: 1, pointerEvents: "none",
            }}>
              {FILES[col]}
            </span>
          )}
        </div>
      )
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* board wrapper */}
      <div style={{
        position: "relative",
        width: BOARD_PX,
        height: BOARD_PX,
        border: `3px solid ${theme.border}`,
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: theme.glow ?? undefined,
      }}>
        {/* Layer 1 + 2: squares and pieces */}
        {squares}

        {/* Layer 3: particle canvas */}
        <canvas
          ref={canvasRef}
          width={BOARD_PX}
          height={BOARD_PX}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      </div>

      {/* feedback message */}
      {msg && (
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: solved ? "#4ade80" : "#fbbf24",
          textAlign: "center", minHeight: 20,
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          padding: "4px 12px",
          background: "rgba(0,0,0,0.35)",
          borderRadius: 8,
          maxWidth: BOARD_PX,
        }}>
          {msg}
        </div>
      )}

      {/* controls */}
      {!solved && !freePlay && (
        <button
          onClick={showHint}
          style={{
            fontSize: 12, padding: "5px 14px",
            background: "rgba(255,255,255,0.08)",
            border: `1px solid ${theme.hintColor}66`,
            borderRadius: 6, color: theme.hintColor,
            cursor: "pointer",
          }}
        >
          Activate Tactical Scouter →
        </button>
      )}
    </div>
  )
}
