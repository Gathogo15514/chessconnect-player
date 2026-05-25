import { NextResponse } from "next/server"
import { getRpgName } from "@/lib/puzzle-tags"

const LICHESS_DAILY = "https://lichess.org/api/puzzle/daily"
const LICHESS_RANDOM = "https://lichess.org/api/puzzle/next"

type LichessPuzzle = {
  puzzle: {
    id:        string
    fen:       string
    plays:     number
    rating:    number
    solution:  string[]   // UCI moves
    themes:    string[]
  }
  game?: {
    pgn?: string
  }
}

function uciToSimple(uciMoves: string[]): string[] {
  // Return as-is; ChessBoard accepts UCI (e.g. "e2e4", "d7d8q")
  return uciMoves
}

function xpForRating(rating: number): number {
  if (rating >= 2000) return 80
  if (rating >= 1800) return 60
  if (rating >= 1500) return 40
  if (rating >= 1200) return 25
  return 15
}

async function fetchPuzzle(url: string): Promise<LichessPuzzle | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // cache daily puzzle for 1h
    })
    if (!res.ok) return null
    return await res.json() as LichessPuzzle
  } catch {
    return null
  }
}

export async function GET() {
  // Try daily first, then random fallback
  let data = await fetchPuzzle(LICHESS_DAILY)
  if (!data) data = await fetchPuzzle(LICHESS_RANDOM)
  if (!data) {
    return NextResponse.json({ error: "Lichess unavailable" }, { status: 502 })
  }

  const { puzzle } = data
  const title = getRpgName(puzzle.themes)

  return NextResponse.json({
    id:             `lichess_${puzzle.id}`,
    fen_position:   puzzle.fen,
    solution_moves: uciToSimple(puzzle.solution),
    title,
    themes:         puzzle.themes,
    rating:         puzzle.rating,
    xp_reward:      xpForRating(puzzle.rating),
    source:         "lichess",
  })
}
