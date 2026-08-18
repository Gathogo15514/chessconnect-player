"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  BOARD_THEMES, PIECE_SETS, PIECE_UNICODE, FILES,
  lichessPieceFile, pieceKey,
  type ThemeId, type PieceSetId,
} from "./themes"
import { PromotionPicker } from "./PromotionPicker"
import { playMoveSound, playCaptureSound, playSolveSound } from "@/lib/chess-sounds"
import type { PromotionPiece } from "@/lib/chess/engine"

export type BoardSettings = {
  boardTheme: ThemeId
  pieceSet: PieceSetId
  /** Default orientation for boards that don't have a forced side (puzzles
   * force orientation to the player's assigned color regardless of this). */
  boardFlipped: boolean
  showCoordinates: boolean
  showLegalMoves: boolean
  animateMoves: boolean
  soundEnabled: boolean
  highlightLastMove: boolean
}

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  boardTheme: "classic",
  pieceSet: "standard",
  boardFlipped: false,
  showCoordinates: true,
  showLegalMoves: true,
  animateMoves: true,
  soundEnabled: true,
  highlightLastMove: true,
}

type Piece = { type: "p" | "n" | "b" | "r" | "q" | "k"; color: "w" | "b" }

function parseFen(fen: string): Record<string, Piece> {
  const map: Record<string, Piece> = {}
  const rows = fen.split(" ")[0].split("/")
  rows.forEach((row, ri) => {
    let fi = 0
    for (const ch of row) {
      if (/\d/.test(ch)) { fi += parseInt(ch, 10); continue }
      map[FILES[fi] + (8 - ri)] = { type: ch.toLowerCase() as Piece["type"], color: ch === ch.toUpperCase() ? "w" : "b" }
      fi++
    }
  })
  return map
}

function squareCoords(square: string, flipped: boolean): { col: number; row: number } {
  const file = FILES.indexOf(square[0])
  const rank = parseInt(square[1], 10)
  return { col: flipped ? 7 - file : file, row: flipped ? rank - 1 : 8 - rank }
}

function squareAt(col: number, row: number, flipped: boolean): string {
  const file = flipped ? 7 - col : col
  const rank = flipped ? row + 1 : 8 - row
  return FILES[file] + rank
}

export type ChessBoardProps = {
  fen: string
  /** Called with a fully-formed move attempt. The caller (activity engine or a
   * bare ChessEngine) owns legality/rules — this component never decides on
   * its own whether a move is "correct," only whether it's worth attempting. */
  onMove: (from: string, to: string, promotion?: PromotionPiece) => void
  getLegalTargets?: (square: string) => string[]
  getNeedsPromotion?: (from: string, to: string) => boolean
  lastMove?: { from: string; to: string } | null
  checkedSquare?: string | null
  /** Which side's pieces the player may pick up. "both" follows the FEN's
   * side-to-move (free play); a fixed color locks the board to that side
   * regardless of whose turn it nominally is (puzzles, where the player
   * always plays one color across the whole line). */
  movableColor?: "w" | "b" | "both"
  interactive?: boolean
  flipped?: boolean
  settings?: Partial<BoardSettings>
  className?: string
}

export function ChessBoard({
  fen, onMove, getLegalTargets, getNeedsPromotion,
  lastMove = null, checkedSquare = null,
  movableColor = "both", interactive = true, flipped = false,
  settings: settingsProp, className,
}: ChessBoardProps) {
  const settings: BoardSettings = { ...DEFAULT_BOARD_SETTINGS, ...settingsProp }
  const theme = BOARD_THEMES[settings.boardTheme] ?? BOARD_THEMES.classic
  const pieceSet = PIECE_SETS[settings.pieceSet] ?? PIECE_SETS.standard

  const boardMap = useMemo(() => parseFen(fen), [fen])
  const sideToMove = (fen.split(" ")[1] === "b" ? "b" : "w") as "w" | "b"

  const [selected, setSelected] = useState<string | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: "w" | "b" } | null>(null)
  const [dragSquare, setDragSquare] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverSquare, setHoverSquare] = useState<string | null>(null)

  const boardRef = useRef<HTMLDivElement>(null)
  const pointerDownRef = useRef<{ square: string; x: number; y: number; dragging: boolean } | null>(null)

  const canMove = useCallback((color: "w" | "b") => {
    if (!interactive) return false
    return movableColor === "both" ? color === sideToMove : color === movableColor
  }, [interactive, movableColor, sideToMove])

  const legalTargets = useCallback((square: string): string[] => {
    return getLegalTargets ? getLegalTargets(square) : []
  }, [getLegalTargets])

  const selectedTargets = selected ? legalTargets(selected) : []

  function squareFromPoint(clientX: number, clientY: number): string | null {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
    const col = Math.min(7, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 8)))
    const row = Math.min(7, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * 8)))
    return squareAt(col, row, flipped)
  }

  function playFeedbackSound(isCapture: boolean) {
    if (!settings.soundEnabled) return
    if (isCapture) playCaptureSound(settings.boardTheme)
    else playMoveSound(settings.boardTheme)
  }

  function commitMove(from: string, to: string) {
    if (getNeedsPromotion?.(from, to)) {
      const piece = boardMap[from]
      setPendingPromotion({ from, to, color: piece?.color ?? sideToMove })
      return
    }
    playFeedbackSound(!!boardMap[to])
    onMove(from, to)
    setSelected(null)
  }

  function resolvePromotion(type: PromotionPiece) {
    if (!pendingPromotion) return
    playFeedbackSound(!!boardMap[pendingPromotion.to])
    onMove(pendingPromotion.from, pendingPromotion.to, type)
    setPendingPromotion(null)
    setSelected(null)
  }

  function handlePointerDown(square: string, e: React.PointerEvent) {
    if (!interactive || pendingPromotion) return
    const piece = boardMap[square]

    if (selected && selected !== square && selectedTargets.includes(square) && !(piece && canMove(piece.color))) {
      commitMove(selected, square)
      return
    }

    if (piece && canMove(piece.color)) {
      setSelected(square)
      pointerDownRef.current = { square, x: e.clientX, y: e.clientY, dragging: false }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }

    if (selected) setSelected(null)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const down = pointerDownRef.current
    if (!down) return
    const dx = e.clientX - down.x
    const dy = e.clientY - down.y
    if (!down.dragging && Math.hypot(dx, dy) > 5) down.dragging = true
    if (down.dragging) {
      setDragSquare(down.square)
      const rect = boardRef.current?.getBoundingClientRect()
      if (rect) setDragPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
      setHoverSquare(squareFromPoint(e.clientX, e.clientY))
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const down = pointerDownRef.current
    pointerDownRef.current = null
    setDragSquare(null)
    setDragPos(null)
    setHoverSquare(null)
    if (!down || !down.dragging) return // plain click already handled on pointerdown
    const target = squareFromPoint(e.clientX, e.clientY)
    if (target && target !== down.square && legalTargets(down.square).includes(target)) {
      commitMove(down.square, target)
    }
  }

  // Keyboard activation (Enter/Space fire a synthetic click with detail === 0,
  // distinguishing it from real pointer-driven clicks already handled above).
  function handleKeyboardClick(square: string, e: React.MouseEvent) {
    if (e.detail !== 0 || !interactive || pendingPromotion) return
    const piece = boardMap[square]
    if (selected && selected !== square && selectedTargets.includes(square) && !(piece && canMove(piece.color))) {
      commitMove(selected, square)
      return
    }
    if (piece && canMove(piece.color)) { setSelected(square); return }
    if (selected) setSelected(null)
  }

  function handleSquareKeyDown(square: string, e: React.KeyboardEvent) {
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    }
    const delta = arrows[e.key]
    if (!delta) return
    e.preventDefault()
    const { col, row } = squareCoords(square, flipped)
    const nextCol = Math.min(7, Math.max(0, col + delta[0]))
    const nextRow = Math.min(7, Math.max(0, row + delta[1]))
    const nextSquare = squareAt(nextCol, nextRow, flipped)
    const btn = boardRef.current?.querySelector<HTMLButtonElement>(`[data-square="${nextSquare}"]`)
    btn?.focus()
  }

  const draggedPiece = dragSquare ? boardMap[dragSquare] : null

  return (
    <div className={className}>
      <div
        ref={boardRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-xl shadow-lg"
        style={{ aspectRatio: "1", border: `2px solid ${theme.border}`, boxShadow: theme.glow ?? "0 4px 24px rgba(0,0,0,0.25)" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {Array.from({ length: 64 }, (_, i) => {
          const col = i % 8
          const row = Math.floor(i / 8)
          const square = squareAt(col, row, flipped)
          const piece = boardMap[square]
          const isLight = (col + row) % 2 === 0
          const isSelected = selected === square
          const isTarget = settings.showLegalMoves && selectedTargets.includes(square)
          const isLastMove = settings.highlightLastMove && !!lastMove && (lastMove.from === square || lastMove.to === square)
          const isChecked = checkedSquare === square
          const isHoverTarget = hoverSquare === square && dragSquare && legalTargets(dragSquare).includes(square)

          let bg = isLight ? theme.lightSquare : theme.darkSquare
          if (isLastMove) bg = theme.lastMoveSquare
          if (isHoverTarget) bg = theme.selectedSquare
          if (isSelected) bg = theme.selectedSquare

          const key = piece ? pieceKey(piece.type, piece.color) : null
          const lichessFile = key && pieceSet.imageBase ? lichessPieceFile(key) : undefined
          const isBeingDragged = dragSquare === square

          return (
            <button
              key={square}
              type="button"
              data-square={square}
              tabIndex={interactive ? 0 : -1}
              aria-label={piece ? `${square}, ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : square}
              onPointerDown={e => handlePointerDown(square, e)}
              onClick={e => handleKeyboardClick(square, e)}
              onKeyDown={e => handleSquareKeyDown(square, e)}
              className="absolute flex cursor-pointer items-center justify-center border-0 p-0 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-offset-[-2px]"
              style={{
                left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: "12.5%", height: "12.5%",
                background: bg,
                boxShadow: isChecked ? "inset 0 0 0 3px #ef4444, inset 0 0 16px rgba(239,68,68,0.6)" : undefined,
                cursor: interactive && piece && canMove(piece.color) ? "grab" : interactive ? "pointer" : "default",
              }}
            >
              {isTarget && !piece && (
                <span aria-hidden style={{ width: "28%", height: "28%", borderRadius: "50%", background: "rgba(0,0,0,0.22)" }} />
              )}
              {isTarget && piece && (
                <span aria-hidden style={{ position: "absolute", inset: 2, borderRadius: 4, border: "3px solid rgba(0,0,0,0.28)" }} />
              )}
              {piece && !isBeingDragged && (
                lichessFile ? (
                  <img
                    src={`${pieceSet.imageBase}${lichessFile}.svg`} alt="" draggable={false}
                    style={{ width: "82%", height: "82%", objectFit: "contain", transition: settings.animateMoves ? "transform 0.1s ease" : undefined, transform: isSelected ? "scale(1.08)" : undefined }}
                  />
                ) : (
                  <span style={{ fontSize: "min(7vw,40px)", lineHeight: 1, color: piece.color === "w" ? pieceSet.whitePiece : pieceSet.blackPiece, textShadow: piece.color === "w" ? pieceSet.whiteShadow : pieceSet.blackShadow, transition: settings.animateMoves ? "transform 0.1s ease" : undefined, transform: isSelected ? "scale(1.08)" : undefined }}>
                    {PIECE_UNICODE[key!]}
                  </span>
                )
              )}
              {settings.showCoordinates && col === (flipped ? 7 : 0) && (
                <span aria-hidden className="pointer-events-none absolute top-0.5 left-1 text-[9px] font-bold leading-none" style={{ color: isLight ? theme.darkSquare : theme.lightSquare, opacity: 0.85 }}>
                  {square[1]}
                </span>
              )}
              {settings.showCoordinates && row === (flipped ? 0 : 7) && (
                <span aria-hidden className="pointer-events-none absolute bottom-0.5 right-1 text-[9px] font-bold leading-none" style={{ color: isLight ? theme.darkSquare : theme.lightSquare, opacity: 0.85 }}>
                  {square[0]}
                </span>
              )}
            </button>
          )
        })}

        {/* Dragged piece ghost, follows the pointer. Positioned in board-relative
            percentages (not px) so no DOM ref read is needed at render time. */}
        {draggedPiece && dragPos && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-30 flex items-center justify-center"
            style={{ left: `calc(${dragPos.x}% - 6.25%)`, top: `calc(${dragPos.y}% - 6.25%)`, width: "12.5%", height: "12.5%" }}
          >
            {(() => {
              const key = pieceKey(draggedPiece.type, draggedPiece.color)
              const lichessFile = pieceSet.imageBase ? lichessPieceFile(key) : undefined
              return lichessFile ? (
                <img src={`${pieceSet.imageBase}${lichessFile}.svg`} alt="" style={{ width: "90%", height: "90%", filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))" }} />
              ) : (
                <span style={{ fontSize: "min(7.5vw,44px)", color: draggedPiece.color === "w" ? pieceSet.whitePiece : pieceSet.blackPiece, textShadow: draggedPiece.color === "w" ? pieceSet.whiteShadow : pieceSet.blackShadow, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))" }}>
                  {PIECE_UNICODE[key]}
                </span>
              )
            })()}
          </div>
        )}

        {pendingPromotion && (
          <PromotionPicker
            square={pendingPromotion.to}
            color={pendingPromotion.color}
            flipped={flipped}
            pieceSet={pieceSet}
            onPick={resolvePromotion}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
      </div>
    </div>
  )
}

/** Exposed so a "game end" sound (checkmate/stalemate) can be triggered by
 * callers that know the activity finished — kept separate from per-move
 * sounds since ChessBoard itself doesn't track game-over state. */
export function playGameEndSound(theme: ThemeId, enabled: boolean) {
  if (enabled) playSolveSound(theme)
}
