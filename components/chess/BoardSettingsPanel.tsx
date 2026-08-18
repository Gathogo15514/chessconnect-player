"use client"

import { ChessBoard } from "./ChessBoard"
import { useBoardSettings } from "./BoardSettingsProvider"
import { useActivity } from "@/lib/chess/activity"
import { STARTING_FEN } from "@/lib/chess/engine"
import { BOARD_THEMES, PIECE_SETS, THEME_IDS, PIECE_SET_IDS, type ThemeId, type PieceSetId } from "./themes"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b border-border p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="flex flex-col gap-3.5 p-4">{children}</div>
    </div>
  )
}

function ChoiceGrid<T extends string | boolean>({ options, selected, onSelect }: {
  options: { id: T; render: React.ReactNode }[]
  selected: T
  onSelect: (id: T) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(o => (
        <button
          key={String(o.id)} type="button" onClick={() => onSelect(o.id)}
          className={"rounded-xl border-2 p-2.5 text-left transition-colors " + (selected === o.id ? "border-primary bg-primary/5" : "border-border bg-transparent hover:bg-secondary")}
        >
          {o.render}
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-secondary"
      aria-pressed={checked}
    >
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <span
        className={"relative h-5 w-9 shrink-0 rounded-full transition-colors " + (checked ? "bg-primary" : "bg-muted")}
      >
        <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform " + (checked ? "translate-x-4" : "translate-x-0.5")} />
      </span>
    </button>
  )
}

/** The one "Board Settings" surface for the whole app — theme, pieces,
 * orientation, coordinates, legal-move indicators, animation, sound, and
 * last-move highlight, all applied live via BoardSettingsProvider. Includes
 * an interactive preview board so a change is felt immediately, not just
 * described. */
export function BoardSettingsPanel() {
  const { settings, updateSettings } = useBoardSettings()
  const preview = useActivity({ id: "board-settings-preview", type: "practice", fen: STARTING_FEN })

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-[280px]">
        <ChessBoard
          fen={preview.fen}
          onMove={(from, to, promotion) => preview.attemptMove(from, to, promotion)}
          getLegalTargets={sq => preview.engine.legalTargets(sq)}
          getNeedsPromotion={(from, to) => preview.needsPromotion(from, to)}
          lastMove={preview.lastMove}
          checkedSquare={preview.engine.checkedKingSquare}
          movableColor="both"
          flipped={settings.boardFlipped}
          settings={settings}
        />
      </div>

      <Section title="Board theme">
        <ChoiceGrid
          selected={settings.boardTheme}
          onSelect={(id: ThemeId) => updateSettings({ boardTheme: id })}
          options={THEME_IDS.map(id => {
            const t = BOARD_THEMES[id]
            return {
              id,
              render: (
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 grid-cols-4 overflow-hidden rounded-md">
                    {Array.from({ length: 16 }, (_, i) => (
                      <div key={i} style={{ background: (Math.floor(i / 4) + i) % 2 === 0 ? t.lightSquare : t.darkSquare }} />
                    ))}
                  </div>
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{t.displayName}</p>
                </div>
              ),
            }
          })}
        />
      </Section>

      <Section title="Piece style">
        <ChoiceGrid
          selected={settings.pieceSet}
          onSelect={(id: PieceSetId) => updateSettings({ pieceSet: id })}
          options={PIECE_SET_IDS.map(id => {
            const ps = PIECE_SETS[id]
            return {
              id,
              render: (
                <div className="flex items-center gap-2">
                  <span className="text-xl" style={{ color: ps.whitePiece, textShadow: ps.whiteShadow }}>♔</span>
                  <span className="text-xl" style={{ color: ps.blackPiece, textShadow: ps.blackShadow }}>♚</span>
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{ps.displayName}</p>
                </div>
              ),
            }
          })}
        />
      </Section>

      <Section title="Board orientation">
        <ChoiceGrid
          selected={settings.boardFlipped}
          onSelect={(v: boolean) => updateSettings({ boardFlipped: v })}
          options={[
            { id: false, render: <><p className="text-[12.5px] font-semibold text-foreground">Play as White</p><p className="mt-0.5 text-[11px] text-muted-foreground">White at bottom</p></> },
            { id: true, render: <><p className="text-[12.5px] font-semibold text-foreground">Play as Black</p><p className="mt-0.5 text-[11px] text-muted-foreground">Black at bottom</p></> },
          ]}
        />
      </Section>

      <Section title="Display">
        <Toggle label="Show coordinates" checked={settings.showCoordinates} onChange={v => updateSettings({ showCoordinates: v })} />
        <Toggle label="Show legal moves" checked={settings.showLegalMoves} onChange={v => updateSettings({ showLegalMoves: v })} />
        <Toggle label="Highlight last move" checked={settings.highlightLastMove} onChange={v => updateSettings({ highlightLastMove: v })} />
        <Toggle label="Move animation" checked={settings.animateMoves} onChange={v => updateSettings({ animateMoves: v })} />
        <Toggle label="Sound" checked={settings.soundEnabled} onChange={v => updateSettings({ soundEnabled: v })} />
      </Section>
    </div>
  )
}
