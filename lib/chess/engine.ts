// Single rules authority for the whole app — every board/activity consumes this,
// never chess.js directly, so legality/check/mate/draw detection lives in exactly
// one place instead of being reimplemented per feature.

import { Chess, type Square, type PieceSymbol, type Color as ChessJsColor } from "chess.js"

export type Color = "w" | "b"
export type PromotionPiece = "q" | "r" | "b" | "n"

export type EngineMove = {
  from: string
  to: string
  san: string
  uci: string
  piece: PieceSymbol
  color: Color
  captured?: PieceSymbol
  promotion?: PromotionPiece
  isCapture: boolean
  isCheck: boolean
  isCheckmate: boolean
  flags: string
}

export type GameStatus =
  | "in_progress"
  | "check"
  | "checkmate"
  | "stalemate"
  | "draw_insufficient_material"
  | "draw_repetition"
  | "draw_fifty_move"
  | "draw"

export type BoardSquareState = {
  square: string
  piece: { type: PieceSymbol; color: Color } | null
}

export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ""}`
}

function statusFor(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return "checkmate"
  if (chess.isStalemate()) return "stalemate"
  if (chess.isThreefoldRepetition()) return "draw_repetition"
  if (chess.isInsufficientMaterial()) return "draw_insufficient_material"
  // chess.js' isDraw() also covers the fifty-move rule; isThreefold/Insufficient
  // are checked first above so this branch is reached only for the 50-move case
  // (or generic draw fallback if a future chess.js version adds another reason).
  if (chess.isDraw()) return "draw_fifty_move"
  if (chess.isCheck()) return "check"
  return "in_progress"
}

/** Wraps chess.js so every consumer (board UI, activity engine, puzzle solver,
 * classroom analysis) shares one rules implementation instead of hand-rolling
 * castling/en passant/promotion/check detection per feature. */
export class ChessEngine {
  private chess: Chess

  constructor(fen: string = STARTING_FEN) {
    this.chess = new Chess(fen)
  }

  get fen(): string { return this.chess.fen() }
  get turn(): Color { return this.chess.turn() as Color }
  get status(): GameStatus { return statusFor(this.chess) }
  get isGameOver(): boolean { return this.chess.isGameOver() }
  get inCheck(): boolean { return this.chess.isCheck() }

  /** Square the side-to-move's king sits on, or null if not in check — used for
   * check highlighting without the caller needing to scan the board itself. */
  get checkedKingSquare(): string | null {
    if (!this.chess.isCheck()) return null
    const color = this.chess.turn()
    const board = this.chess.board()
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c]
        if (cell && cell.type === "k" && cell.color === color) return cell.square
      }
    }
    return null
  }

  loadFen(fen: string): boolean {
    try { this.chess = new Chess(fen); return true }
    catch { return false }
  }

  loadPgn(pgn: string): boolean {
    try { this.chess.loadPgn(pgn); return true }
    catch { return false }
  }

  pgn(): string { return this.chess.pgn() }

  reset(): void { this.chess.reset() }

  clone(): ChessEngine { return new ChessEngine(this.fen) }

  board(): BoardSquareState[] {
    const out: BoardSquareState[] = []
    const rows = this.chess.board()
    for (const row of rows) {
      for (const cell of row) {
        if (!cell) continue
        out.push({ square: cell.square, piece: { type: cell.type, color: cell.color as Color } })
      }
    }
    return out
  }

  pieceAt(square: string): { type: PieceSymbol; color: Color } | null {
    const p = this.chess.get(square as Square)
    return p ? { type: p.type, color: p.color as Color } : null
  }

  /** Legal destination squares from `square`, or [] if empty/not-your-turn/game over. */
  legalTargets(square: string): string[] {
    if (this.chess.isGameOver()) return []
    try {
      return this.chess.moves({ square: square as Square, verbose: true }).map(m => m.to)
    } catch { return [] }
  }

  /** True if moving the piece on `from` to `to` requires a promotion choice
   * (i.e. is only legal with a promotion piece specified). */
  needsPromotion(from: string, to: string): boolean {
    try {
      const moves = this.chess.moves({ square: from as Square, verbose: true })
      return moves.some(m => m.to === to && m.promotion)
    } catch { return false }
  }

  /** Attempts the move; returns null if illegal. Mutates internal state on success. */
  move(from: string, to: string, promotion?: PromotionPiece): EngineMove | null {
    try {
      const result = this.chess.move({ from: from as Square, to: to as Square, promotion })
      if (!result) return null
      return {
        from: result.from, to: result.to, san: result.san,
        uci: toUci(result.from, result.to, result.promotion),
        piece: result.piece, color: result.color as Color,
        captured: result.captured, promotion: result.promotion as PromotionPiece | undefined,
        isCapture: !!result.captured,
        isCheck: this.chess.isCheck(),
        isCheckmate: this.chess.isCheckmate(),
        flags: result.flags,
      }
    } catch { return null }
  }

  /** Applies a move given in UCI form ("e2e4", "e7e8q"). */
  moveUci(uci: string): EngineMove | null {
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? (uci[4] as PromotionPiece) : undefined
    return this.move(from, to, promotion)
  }

  undo(): EngineMove | null {
    const result = this.chess.undo()
    if (!result) return null
    return {
      from: result.from, to: result.to, san: result.san,
      uci: toUci(result.from, result.to, result.promotion),
      piece: result.piece, color: result.color as Color,
      captured: result.captured, promotion: result.promotion as PromotionPiece | undefined,
      isCapture: !!result.captured,
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      flags: result.flags,
    }
  }

  history(): EngineMove[] {
    return this.chess.history({ verbose: true }).map(m => ({
      from: m.from, to: m.to, san: m.san,
      uci: toUci(m.from, m.to, m.promotion),
      piece: m.piece, color: m.color as Color,
      captured: m.captured, promotion: m.promotion as PromotionPiece | undefined,
      isCapture: !!m.captured,
      isCheck: false, isCheckmate: false, // not knowable retroactively without replay; unused by callers
      flags: m.flags,
    }))
  }
}

export function colorName(c: ChessJsColor): "White" | "Black" {
  return c === "w" ? "White" : "Black"
}
