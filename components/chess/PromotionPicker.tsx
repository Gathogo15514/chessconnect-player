"use client"

import { FILES, PIECE_UNICODE, lichessPieceFile, pieceKey, type PieceSetDef } from "./themes"
import type { PromotionPiece } from "@/lib/chess/engine"

const CHOICES: PromotionPiece[] = ["q", "r", "b", "n"]

type Props = {
  square: string
  color: "w" | "b"
  flipped: boolean
  pieceSet: PieceSetDef
  onPick: (type: PromotionPiece) => void
  onCancel: () => void
}

/** Floating Q/R/B/N picker anchored over the promotion square. A full-board
 * backdrop intercepts clicks so tapping elsewhere cancels the pending move —
 * a pawn reaching the last rank must never auto-promote without the player
 * choosing, per spec. */
export function PromotionPicker({ square, color, flipped, pieceSet, onPick, onCancel }: Props) {
  const file = FILES.indexOf(square[0])
  const rank = parseInt(square[1], 10)
  const col = flipped ? 7 - file : file
  const row = flipped ? rank - 1 : 8 - rank
  const stackDown = row === 0

  return (
    <>
      <div
        className="absolute inset-0"
        style={{ zIndex: 40, background: "rgba(0,0,0,0.35)" }}
        onClick={onCancel}
        onContextMenu={e => e.preventDefault()}
        role="presentation"
      />
      <div
        className="absolute flex overflow-hidden rounded-lg border border-black/10 bg-white shadow-2xl"
        style={{
          left: `${col * 12.5}%`, width: "12.5%", zIndex: 50,
          top: stackDown ? `${row * 12.5}%` : undefined,
          bottom: stackDown ? undefined : `${(7 - row) * 12.5}%`,
          flexDirection: stackDown ? "column" : "column-reverse",
        }}
        role="group"
        aria-label="Choose promotion piece"
      >
        {CHOICES.map(type => {
          const key = pieceKey(type, color)
          const lichessFile = pieceSet.imageBase ? lichessPieceFile(key) : undefined
          return (
            <button
              key={type}
              type="button"
              onClick={() => onPick(type)}
              className="flex aspect-square items-center justify-center bg-white transition-colors hover:bg-amber-100 focus-visible:bg-amber-100"
              aria-label={`Promote to ${type === "q" ? "queen" : type === "r" ? "rook" : type === "b" ? "bishop" : "knight"}`}
            >
              {lichessFile ? (
                <img src={`${pieceSet.imageBase}${lichessFile}.svg`} alt="" width="80%" height="80%" draggable={false} />
              ) : (
                <span style={{ fontSize: "min(6vw,34px)", lineHeight: 1, color: color === "w" ? pieceSet.whitePiece : pieceSet.blackPiece, textShadow: color === "w" ? pieceSet.whiteShadow : pieceSet.blackShadow }}>
                  {PIECE_UNICODE[key]}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}
