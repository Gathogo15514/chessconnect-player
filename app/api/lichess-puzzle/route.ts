import { NextResponse } from "next/server"
import { getRpgName } from "@/lib/puzzle-tags"

const LICHESS_NEXT = "https://lichess.org/api/puzzle/next"

type LichessPuzzle = {
  puzzle: {
    id:       string
    fen:      string
    plays:    number
    rating:   number
    solution: string[]
    themes:   string[]
  }
}

function xpForRating(rating: number): number {
  if (rating >= 2000) return 80
  if (rating >= 1800) return 60
  if (rating >= 1500) return 40
  if (rating >= 1200) return 25
  return 15
}

export async function GET() {
  try {
    const res = await fetch(LICHESS_NEXT, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) {
      return NextResponse.json({ error: "Lichess unavailable" }, { status: 502 })
    }
    const data = await res.json() as LichessPuzzle
    const { puzzle } = data
    const title = getRpgName(puzzle.themes)

    return NextResponse.json(
      {
        id:             `lichess_${puzzle.id}`,
        fen_position:   puzzle.fen,
        solution_moves: puzzle.solution,
        title,
        themes:         puzzle.themes,
        rating:         puzzle.rating,
        xp_reward:      xpForRating(puzzle.rating),
        source:         "lichess",
      },
      { headers: { "Cache-Control": "no-store, no-cache" } }
    )
  } catch {
    return NextResponse.json({ error: "Lichess unavailable" }, { status: 502 })
  }
}
