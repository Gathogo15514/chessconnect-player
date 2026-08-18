"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from "./ChessBoard"

const STORAGE_KEY = "chesslead-board-settings"

type Ctx = {
  settings: BoardSettings
  updateSettings: (patch: Partial<BoardSettings>) => void
  loaded: boolean
}

const BoardSettingsContext = createContext<Ctx | null>(null)

function readLocal(): Partial<BoardSettings> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function writeLocal(settings: BoardSettings) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* private browsing etc */ }
}

/** Board appearance preferences: hydrated from localStorage synchronously on
 * mount (no flash of defaults on repeat visits), then reconciled against
 * `player_board_prefs` once the session/player id resolve. Writes go to both
 * — localStorage for instant apply and logged-out/guest use, the DB row so
 * preferences follow the player across devices. */
export function BoardSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<BoardSettings>(() => ({ ...DEFAULT_BOARD_SETTINGS, ...readLocal() }))
  const [loaded, setLoaded] = useState(false)
  const playerIdRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoaded(true); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: player } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!player) { setLoaded(true); return }
      playerIdRef.current = player.id

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prefs } = await (supabase.from("player_board_prefs") as any)
        .select("*").eq("player_id", player.id).maybeSingle()
      if (prefs) {
        const fromDb: Partial<BoardSettings> = {
          boardTheme: prefs.board_theme, pieceSet: prefs.piece_set, boardFlipped: prefs.board_flipped,
          showCoordinates: prefs.show_coordinates, showLegalMoves: prefs.show_legal_moves,
          animateMoves: prefs.animate_moves, soundEnabled: prefs.sound_enabled,
          highlightLastMove: prefs.highlight_last_move,
        }
        setSettings(prev => {
          const next = { ...prev, ...fromDb }
          writeLocal(next)
          return next
        })
      }
      setLoaded(true)
    })
  }, [])

  const updateSettings = useCallback((patch: Partial<BoardSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      writeLocal(next)
      const playerId = playerIdRef.current
      if (playerId) {
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(supabase.from("player_board_prefs") as any).upsert({
          player_id: playerId,
          board_theme: next.boardTheme, piece_set: next.pieceSet, board_flipped: next.boardFlipped,
          show_coordinates: next.showCoordinates, show_legal_moves: next.showLegalMoves,
          animate_moves: next.animateMoves, sound_enabled: next.soundEnabled,
          highlight_last_move: next.highlightLastMove,
        }, { onConflict: "player_id" }).then(() => {})
      }
      return next
    })
  }, [])

  return (
    <BoardSettingsContext.Provider value={{ settings, updateSettings, loaded }}>
      {children}
    </BoardSettingsContext.Provider>
  )
}

export function useBoardSettings(): Ctx {
  const ctx = useContext(BoardSettingsContext)
  if (!ctx) throw new Error("useBoardSettings must be used within a BoardSettingsProvider")
  return ctx
}
