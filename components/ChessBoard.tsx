"use client"

import { useState, useMemo, useCallback } from "react"
import { Chess } from "chess.js"

const PIECES: Record<string, string> = {
  wk:"♔", wq:"♕", wr:"♖", wb:"♗", wn:"♘", wp:"♙",
  bk:"♚", bq:"♛", br:"♜", bb:"♝", bn:"♞", bp:"♟",
}
const FILES = ["a","b","c","d","e","f","g","h"]

function parseFen(fen: string): Record<string, string> {
  const pieces: Record<string, string> = {}
  const rows = fen.split(" ")[0].split("/")
  rows.forEach((row, ri) => {
    let fi = 0
    for (const ch of row) {
      if (/\d/.test(ch)) { fi += parseInt(ch); continue }
      const color = ch === ch.toUpperCase() ? "w" : "b"
      const sq = FILES[fi] + (8 - ri)
      pieces[sq] = color + ch.toLowerCase()
      fi++
    }
  })
  return pieces
}

export type ChessBoardProps = {
  fen:            string
  solutionMoves:  string[]
  playerColor:    "w" | "b"
  onSolved:       () => void
  onWrongMove?:   () => void
}

export function ChessBoard({ fen, solutionMoves, playerColor, onSolved, onWrongMove }: ChessBoardProps) {
  const [step,       setStep]       = useState(0)
  const [currentFen, setCurrentFen] = useState(fen)
  const [pieces,     setPieces]     = useState(() => parseFen(fen))
  const [selected,   setSelected]   = useState<string | null>(null)
  const [flash,      setFlash]      = useState<{ sq: string; type: "wrong" | "correct" } | null>(null)
  const [lastMove,   setLastMove]   = useState<{ from: string; to: string } | null>(null)
  const [solved,     setSolved]     = useState(false)
  const [busy,       setBusy]       = useState(false) // opponent thinking

  const engine = useMemo(() => {
    try { return new Chess(currentFen) } catch { return new Chess() }
  }, [currentFen])

  const legalTargets = useMemo<Set<string>>(() => {
    if (!selected || busy || solved) return new Set()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Set(engine.moves({ square: selected as any, verbose: true }).map((m: any) => m.to))
    } catch { return new Set() }
  }, [selected, engine, busy, solved])

  const applyUciMove = useCallback((uci: string, fenSrc: string) => {
    const tmp = new Chess(fenSrc)
    const from = uci.slice(0, 2)
    const to   = uci.slice(2, 4)
    const promo = uci[4]
    try {
      const result = tmp.move({ from, to, promotion: promo ?? "q" })
      if (!result) return null
      return { fen: tmp.fen(), pieces: parseFen(tmp.fen()), from, to }
    } catch { return null }
  }, [])

  function handleSquareClick(sq: string) {
    if (busy || solved) return

    const piece = pieces[sq]
    const pieceColor = piece?.[0]

    // Select own piece
    if (piece && pieceColor === playerColor) {
      setSelected(sq)
      return
    }

    // Attempt move
    if (selected && legalTargets.has(sq)) {
      const uci       = selected + sq
      const expected  = solutionMoves[step]

      if (!expected || uci !== expected) {
        setFlash({ sq, type: "wrong" })
        setTimeout(() => setFlash(null), 600)
        onWrongMove?.()
        setSelected(null)
        return
      }

      // Correct player move
      const applied = applyUciMove(uci, currentFen)
      if (!applied) return

      setFlash({ sq: applied.to, type: "correct" })
      setTimeout(() => setFlash(null), 400)
      setLastMove({ from: applied.from, to: applied.to })
      setPieces(applied.pieces)
      setCurrentFen(applied.fen)
      setSelected(null)

      const nextStep = step + 1
      setStep(nextStep)

      // All player moves done?
      if (nextStep >= solutionMoves.length) { setSolved(true); onSolved(); return }

      // Auto-play opponent response
      const opponentUci = solutionMoves[nextStep]
      if (opponentUci) {
        setBusy(true)
        setTimeout(() => {
          const opp = applyUciMove(opponentUci, applied.fen)
          if (opp) {
            setLastMove({ from: opp.from, to: opp.to })
            setPieces(opp.pieces)
            setCurrentFen(opp.fen)
            setStep(nextStep + 1)
          }
          setBusy(false)
        }, 500)
      }
      return
    }

    setSelected(null)
  }

  const flip = playerColor === "b"
  const ranks = flip ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1]
  const files = flip ? [...FILES].reverse() : FILES

  return (
    <div className="w-full max-w-sm mx-auto select-none">
      {solved && (
        <div className="mb-3 text-center text-green-700 font-semibold text-sm bg-green-50 rounded-xl py-2">
          Tactical solution found!
        </div>
      )}
      {busy && !solved && (
        <div className="mb-3 text-center text-stone-500 text-sm">Opponent thinking…</div>
      )}
      <div className="rounded-xl overflow-hidden shadow-md border border-stone-300"
           style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", aspectRatio:"1" }}>
        {ranks.flatMap(rank =>
          files.map(file => {
            const sq     = file + rank
            const piece  = pieces[sq]
            const light  = (FILES.indexOf(file) + rank) % 2 === 0
            const isSelected   = selected === sq
            const isLegal      = legalTargets.has(sq)
            const isLastMove   = lastMove?.from === sq || lastMove?.to === sq
            const flashState   = flash?.sq === sq ? flash.type : null

            let bg = light ? "#F0D9B5" : "#B58863"
            if (isLastMove) bg = light ? "#CDD26A" : "#AAA23A"
            if (isSelected) bg = "#7FC97F"
            if (flashState === "correct") bg = "#86efac"
            if (flashState === "wrong")   bg = "#fca5a5"

            return (
              <div
                key={sq}
                onClick={() => handleSquareClick(sq)}
                style={{ background: bg, position:"relative", cursor: solved ? "default" : "pointer" }}
                className="flex items-center justify-center"
              >
                {isLegal && !piece && (
                  <div style={{ width:"28%", height:"28%", borderRadius:"50%", background:"rgba(0,0,0,0.18)" }} />
                )}
                {isLegal && piece && (
                  <div style={{ position:"absolute", inset:0, border:"3px solid rgba(0,0,0,0.25)", borderRadius:0, pointerEvents:"none" }} />
                )}
                {piece && (
                  <span style={{
                    fontSize:   "clamp(20px, 5vw, 36px)",
                    lineHeight: 1,
                    color:      piece[0] === "w" ? "#fff" : "#1a1a1a",
                    textShadow: piece[0] === "w" ? "0 1px 2px rgba(0,0,0,0.8)" : "0 1px 2px rgba(255,255,255,0.4)",
                    userSelect: "none",
                  }}>
                    {PIECES[piece]}
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
