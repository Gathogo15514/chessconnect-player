export type ThemeId    = "classic" | "cyberpunk_neon" | "enchanted_wood" | "obsidian" | "volcano_forge" | "high_contrast"
export type PieceSetId = "standard" | "robo_mechs" | "elemental_beasts" | "chibi_anime"

export type BoardTheme = {
  id:             ThemeId
  displayName:    string
  emoji:          string
  lightSquare:    string
  darkSquare:     string
  border:         string
  glow?:          string
  selectedSquare: string
  lastMoveSquare: string
  hintColor:      string
}

export type PieceSetDef = {
  id:          PieceSetId
  displayName: string
  emoji:       string
  whitePiece:  string
  blackPiece:  string
  whiteShadow: string
  blackShadow: string
  burstColor:  string
  imageBase?:  string  // Lichess SVG piece set base URL (if set, images override Unicode)
}

export const BOARD_THEMES: Record<ThemeId, BoardTheme> = {
  classic: {
    id: "classic", displayName: "Classic", emoji: "🏛️",
    lightSquare: "#f0d9b5", darkSquare: "#b58863",
    border: "#8B6914",
    selectedSquare: "rgba(255,215,0,0.65)",
    lastMoveSquare: "rgba(155,199,0,0.45)",
    hintColor: "#1baca6",
    glow: "0 8px 40px rgba(0,0,0,0.55), 0 0 0 3px #8B691466",
  },
  cyberpunk_neon: {
    id: "cyberpunk_neon", displayName: "Neon Hackers", emoji: "⚡",
    lightSquare: "rgba(0,242,254,0.18)", darkSquare: "rgba(79,172,254,0.38)",
    border: "#00f2fe", glow: "0 0 20px #00f2fe44",
    selectedSquare: "rgba(255,215,0,0.5)", lastMoveSquare: "rgba(0,242,254,0.35)",
    hintColor: "#00f2fe",
  },
  enchanted_wood: {
    id: "enchanted_wood", displayName: "Enchanted Wood", emoji: "🌿",
    lightSquare: "#d4e8c2", darkSquare: "#4a7c40",
    border: "#2d5a1b", selectedSquare: "#f0e050bb",
    lastMoveSquare: "#a8d880bb", hintColor: "#90c050",
  },
  obsidian: {
    id: "obsidian", displayName: "Obsidian", emoji: "🌑",
    lightSquare: "#3d3d3d", darkSquare: "#1a1a1a",
    border: "#555", selectedSquare: "#7b4f9ecc",
    lastMoveSquare: "#5a3d7ecc", hintColor: "#9b6fbe",
  },
  volcano_forge: {
    id: "volcano_forge", displayName: "Volcano Forge", emoji: "🌋",
    lightSquare: "#4a1a0a", darkSquare: "#1a0800",
    border: "#ff4500", glow: "0 0 24px #ff450055",
    selectedSquare: "rgba(255,140,0,0.55)", lastMoveSquare: "rgba(255,69,0,0.4)",
    hintColor: "#ff6a00",
  },
  // Accessibility theme: maximal luminance contrast between squares, and a
  // selection/hint color (yellow) chosen to stay distinguishable under the
  // common red-green color-vision deficiencies rather than relying on hue alone.
  high_contrast: {
    id: "high_contrast", displayName: "High Contrast", emoji: "◼️",
    lightSquare: "#ffffff", darkSquare: "#000000",
    border: "#000000",
    selectedSquare: "rgba(255,215,0,0.75)",
    lastMoveSquare: "rgba(0,120,255,0.45)",
    hintColor: "#ffd700",
  },
}

export const PIECE_SETS: Record<PieceSetId, PieceSetDef> = {
  standard: {
    id: "standard", displayName: "Classic Pieces", emoji: "♟️",
    whitePiece: "#ffffff", blackPiece: "#1a1a1a",
    whiteShadow: "0 1px 3px rgba(0,0,0,0.9)", blackShadow: "0 1px 2px rgba(255,255,255,0.4)",
    burstColor: "#f0d9b5",
    imageBase: "https://lichess1.org/assets/piece/cburnett/",
  },
  robo_mechs: {
    id: "robo_mechs", displayName: "Robo Mechs", emoji: "🤖",
    whitePiece: "#00f2fe", blackPiece: "#ff6b35",
    whiteShadow: "0 0 8px #00f2fe88", blackShadow: "0 0 8px #ff6b3588",
    burstColor: "#00f2fe",
  },
  elemental_beasts: {
    id: "elemental_beasts", displayName: "Elemental Beasts", emoji: "🐉",
    whitePiece: "#4ade80", blackPiece: "#f87171",
    whiteShadow: "0 0 6px #4ade8088", blackShadow: "0 0 6px #f8717188",
    burstColor: "#4ade80",
  },
  chibi_anime: {
    id: "chibi_anime", displayName: "Chibi Anime", emoji: "🌸",
    whitePiece: "#f9a8d4", blackPiece: "#a78bfa",
    whiteShadow: "0 0 6px #f9a8d488", blackShadow: "0 0 6px #a78bfa88",
    burstColor: "#f9a8d4",
  },
}

export const PIECE_UNICODE: Record<string, string> = {
  K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘", P:"♙",
  k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟",
}

export const FILES = ["a","b","c","d","e","f","g","h"]

export const THEME_IDS = Object.keys(BOARD_THEMES) as ThemeId[]
export const PIECE_SET_IDS = Object.keys(PIECE_SETS) as PieceSetId[]

const PIECE_TO_LICHESS: Record<string, string> = {
  K: "wK", Q: "wQ", R: "wR", B: "wB", N: "wN", P: "wP",
  k: "bK", q: "bQ", r: "bR", b: "bB", n: "bN", p: "bP",
}

/** (piece type, color) -> the single-char key used by PIECE_UNICODE / Lichess sprite lookups. */
export function pieceKey(type: string, color: "w" | "b"): string {
  return color === "w" ? type.toUpperCase() : type.toLowerCase()
}

export function lichessPieceFile(pieceSymbolKey: string): string | undefined {
  return PIECE_TO_LICHESS[pieceSymbolKey]
}
