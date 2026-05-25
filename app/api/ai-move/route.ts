import { NextRequest, NextResponse } from "next/server"
import { Chess } from "chess.js"

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
const MODEL         = "claude-haiku-4-5-20251001"
const MAX_RETRIES   = 3

const SYSTEM_PROMPT = `You are a chess engine assistant for ChessConnect Kids. Given a FEN position, output ONLY a valid UCI move in the format "e2e4". No explanation, no punctuation, just the raw move string. Choose a good move for the current side to move.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 })

  let fen: string
  try {
    const body = await req.json()
    fen = body.fen
    if (!fen || typeof fen !== "string") throw new Error("bad fen")
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Validate FEN and build legal moves list
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return NextResponse.json({ error: "Invalid FEN" }, { status: 400 })
  }

  const legalMoves = chess.moves({ verbose: true })
  if (legalMoves.length === 0) {
    return NextResponse.json({ error: "No legal moves" }, { status: 400 })
  }

  const legalUci = legalMoves.map(m => `${m.from}${m.to}${m.promotion ?? ""}`)
  const userPrompt = `FEN: ${fen}\nLegal moves: ${legalUci.join(", ")}\nChoose the best move:`

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let rawMove: string
    try {
      const res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type":    "application/json",
          "x-api-key":       apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 10,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        if (attempt === MAX_RETRIES) return NextResponse.json({ error: `Anthropic error: ${err}` }, { status: 502 })
        continue
      }

      const data = await res.json()
      rawMove = (data.content?.[0]?.text ?? "").trim().toLowerCase().replace(/[^a-h1-8qrbn]/g, "")
    } catch {
      if (attempt === MAX_RETRIES) return NextResponse.json({ error: "Failed to reach AI" }, { status: 502 })
      continue
    }

    // Validate against legal moves
    const matched = legalUci.find(m => m === rawMove || m.startsWith(rawMove))
    if (!matched) continue

    // Parse matched move back to verbose form
    const moveObj = legalMoves.find(m => `${m.from}${m.to}${m.promotion ?? ""}` === matched)
    if (!moveObj) continue

    return NextResponse.json({
      selected_move_uci: matched,
      selected_move_san: moveObj.san,
      from_square:       moveObj.from,
      to_square:         moveObj.to,
      promotion:         moveObj.promotion ?? null,
    })
  }

  // Fallback: pick a random legal move
  const fallback = legalMoves[Math.floor(Math.random() * legalMoves.length)]
  const fallbackUci = `${fallback.from}${fallback.to}${fallback.promotion ?? ""}`
  return NextResponse.json({
    selected_move_uci: fallbackUci,
    selected_move_san: fallback.san,
    from_square:       fallback.from,
    to_square:         fallback.to,
    promotion:         fallback.promotion ?? null,
    fallback:          true,
  })
}
