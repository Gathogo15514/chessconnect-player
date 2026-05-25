export const LICHESS_TAG_TO_RPG: Record<string, string> = {
  discoveredAttack:  "The Invisible Trap",
  trappedPiece:      "The Caged Target",
  pin:               "The Shield Piercer",
  fork:              "The Double Strike",
  mateIn1:           "The Royal Execution",
  mateIn2:           "The Royal Execution",
  smotheredMate:     "The Royal Execution",
  skewer:            "The Skewer Thrust",
  discoveredCheck:   "The Hidden Blade",
  doubleCheck:       "Twin Strike of Doom",
  attraction:        "The Lure Gambit",
  deflection:        "The Diversion",
  decoy:             "The Decoy Duel",
  clearance:         "The Path Clearer",
  interference:      "The Blockade",
  sacrifice:         "The Noble Sacrifice",
  zugzwang:          "The Doom Move",
  promotion:         "The Pawn Ascension",
  underPromotion:    "The Sneaky Ascension",
  backRankMate:      "The Wall of Doom",
  anastasiaMate:     "The Corridor Trap",
  arabianMate:       "The Desert Ambush",
  bodenMate:         "The Bishop's Revenge",
  doubleBishopMate:  "Twin Bishop Strike",
  hookMate:          "The Hook Snare",
  operaGameMate:     "The Opera Finale",
  queenRookMate:     "The Royal Duo",
  middlegame:        "The Battle Zone",
  endgame:           "The Final Stand",
  opening:           "The First Blood",
  equality:          "The Balance Protocol",
  advantage:         "The Power Surge",
  crushing:          "The Overwhelm",
  veryLong:          "The Endurance Trial",
  long:              "The Extended Duel",
  short:             "The Quick Strike",
  oneMove:           "The One-Hit Wonder",
}

export function getRpgName(tags: string[]): string {
  for (const tag of tags) {
    const name = LICHESS_TAG_TO_RPG[tag]
    if (name) return name
  }
  return "Mystery Encounter"
}
