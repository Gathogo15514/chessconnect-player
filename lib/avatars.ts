export type AvatarId =
  | "knight_errant"
  | "dark_bishop"
  | "rook_guardian"
  | "pawn_hero"
  | "queen_sorceress"
  | "king_defender"
  | "shadow_knight"
  | "forest_bishop"

export type Avatar = {
  id:          AvatarId
  name:        string
  class:       string
  emoji:       string
  color:       string
  glow:        string
  unlockLevel: number
  description: string
}

export const AVATARS: Avatar[] = [
  {
    id: "pawn_hero",   name: "Pawn Hero",       class: "Warrior",
    emoji: "🛡️",      color: "#6b7280",         glow: "#6b728044",
    unlockLevel: 1,   description: "Every legend starts as a pawn.",
  },
  {
    id: "knight_errant", name: "Knight Errant", class: "Scout",
    emoji: "⚔️",       color: "#10b981",        glow: "#10b98144",
    unlockLevel: 4,   description: "Leaps over obstacles, strikes from unexpected angles.",
  },
  {
    id: "dark_bishop",  name: "Dark Bishop",    class: "Mage",
    emoji: "🔮",        color: "#8b5cf6",        glow: "#8b5cf644",
    unlockLevel: 7,   description: "Master of diagonals and hidden power.",
  },
  {
    id: "rook_guardian", name: "Rook Guardian", class: "Tank",
    emoji: "🏰",        color: "#3b82f6",        glow: "#3b82f644",
    unlockLevel: 10,  description: "Unyielding fortress. Controls the open files.",
  },
  {
    id: "forest_bishop", name: "Forest Bishop", class: "Ranger",
    emoji: "🌿",        color: "#059669",        glow: "#05966944",
    unlockLevel: 15,  description: "Attuned to nature, strikes with precision.",
  },
  {
    id: "shadow_knight", name: "Shadow Knight", class: "Assassin",
    emoji: "🌑",        color: "#1e1b4b",        glow: "#1e1b4b88",
    unlockLevel: 20,  description: "Strikes from the shadows. Never seen coming.",
  },
  {
    id: "queen_sorceress", name: "Queen Sorceress", class: "Archmage",
    emoji: "✨",          color: "#f59e0b",           glow: "#f59e0b55",
    unlockLevel: 25,  description: "Commands every square. Unstoppable force.",
  },
  {
    id: "king_defender", name: "King Defender",  class: "Paladin",
    emoji: "👑",         color: "#dc2626",         glow: "#dc262655",
    unlockLevel: 30,  description: "The last line of defence. Wisdom and courage.",
  },
]

export function getAvatar(id: AvatarId | string | null | undefined): Avatar {
  return AVATARS.find(a => a.id === id) ?? AVATARS[0]
}
