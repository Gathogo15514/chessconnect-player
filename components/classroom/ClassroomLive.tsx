"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Chess } from "chess.js"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { toast } from "sonner"
import {
  RotateCcw, Trash2, Copy, Save, FlipHorizontal2,
  Send, Users, Video, MessageSquare, RefreshCw,
  CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Hand, Trophy, Lightbulb, Eye, EyeOff, X, Zap, Upload, Cpu, Loader2, Palette,
} from "lucide-react"
import { cn } from "@/lib/utils"
import JitsiEmbed from "./JitsiEmbed"
import { useStockfish } from "@/lib/useStockfish"

/* ─────────────────────── Types ─────────────────────────── */

type Color     = "w" | "b"
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P"

interface Piece { id: string; color: Color; type: PieceType; square: string }
interface Arrow { from: string; to: string }

interface MoveRecord {
  notation:  string  // e.g. "e4", "Nf3", "Bxe5"
  from:      string
  to:        string
  fen:       string  // FEN after this move
}

interface Challenge {
  text:         string   // "Find the best move for White!"
  fen:          string   // position to solve
  correctMoves: string[] // e.g. ["e4", "Nc3"] — SAN or just squares
  targetFen:    string   // FEN of correct answer (first part only)
  explanation:  string   // shown after reveal
}

interface ChatMsg {
  id:         string
  senderName: string
  senderRole: "coach" | "student"
  content:    string
  at:         string
}

interface AnswerSub {
  studentId:   string
  studentName: string
  fen:         string
  lastMove:    string
  isCorrect:   boolean | null  // null = no validation set
  at:          string
}

interface RaisedHand {
  studentId:   string
  studentName: string
}

/* ─────────────────────── Chess Constants ────────────────── */

const FILES = ["a","b","c","d","e","f","g","h"] as const
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const SYMBOLS: Record<string, string> = {
  wK:"♔", wQ:"♕", wR:"♖", wB:"♗", wN:"♘", wP:"♙",
  bK:"♚", bQ:"♛", bR:"♜", bB:"♝", bN:"♞", bP:"♟",
}
const PROMOTION_CHOICES: PieceType[] = ["Q","R","B","N"]

interface BoardTheme { name: string; light: string; dark: string }
const BOARD_THEMES: Record<string, BoardTheme> = {
  classic:  { name:"Classic Wood", light:"#f0d9b5", dark:"#b58863" },
  green:    { name:"Tournament Green", light:"#eeeed2", dark:"#769656" },
  blue:     { name:"Ocean Blue", light:"#dee3e6", dark:"#8ca2ad" },
  coral:    { name:"Coral", light:"#ffe4c4", dark:"#cd6155" },
  marble:   { name:"Marble", light:"#ececec", dark:"#7f7f7f" },
  midnight: { name:"Midnight", light:"#647186", dark:"#3a4557" },
}
type BoardThemeKey = keyof typeof BOARD_THEMES
const DEFAULT_BOARD_THEME: BoardThemeKey = "classic"
const BOARD_THEME_STORAGE_KEY = "chessconnect-board-theme"

/* ─────────────────────── Chess Helpers ──────────────────── */

function squareToXY(sq: string, flip: boolean) {
  const fi = sq.charCodeAt(0) - 97
  const rk = parseInt(sq[1])
  return { x: flip ? 7 - fi : fi, y: flip ? rk - 1 : 8 - rk }
}

function xyToSquare(x: number, y: number, flip: boolean): string {
  return FILES[flip ? 7 - x : x] + (flip ? y + 1 : 8 - y)
}

function isLightAt(x: number, y: number) { return (x + y) % 2 === 0 }

function parseFen(fen: string): Piece[] {
  const rows = fen.split(" ")[0].split("/")
  const counts: Record<string, number> = {}
  const pieces: Piece[] = []
  rows.forEach((row, ri) => {
    let fi = 0
    for (const ch of row) {
      if (/\d/.test(ch)) { fi += parseInt(ch); continue }
      const color = ch === ch.toUpperCase() ? "w" : "b" as Color
      const type  = ch.toUpperCase() as PieceType
      const key   = `${color}${type}`
      counts[key] = (counts[key] ?? 0) + 1
      pieces.push({ id:`${key}-${counts[key]}`, color, type, square: FILES[fi]+(8-ri) })
      fi++
    }
  })
  return pieces
}

function piecesToFen(pieces: Piece[]): string {
  const grid: Record<string, string> = {}
  for (const p of pieces) grid[p.square] = p.color === "w" ? p.type : p.type.toLowerCase()
  const rows: string[] = []
  for (let rk = 8; rk >= 1; rk--) {
    let row = ""; let empty = 0
    for (const f of FILES) {
      const s = grid[f+rk]
      if (s) { if (empty) { row += empty; empty = 0 } row += s } else empty++
    }
    if (empty) row += empty
    rows.push(row)
  }
  return rows.join("/") + " w - - 0 1"
}

function fenPosition(fen: string) { return fen.split(" ")[0] }

function getMoveNotation(moving: Piece, from: string, to: string, pieces: Piece[]): string {
  if (moving.type === "K" && (from + to === "e1g1" || from + to === "e8g8")) return "O-O"
  if (moving.type === "K" && (from + to === "e1c1" || from + to === "e8c8")) return "O-O-O"
  const captured = pieces.find(p => p.square === to && p.color !== moving.color)
  const cap = captured ? "x" : ""
  if (moving.type === "P") return captured ? `${from[0]}x${to}` : to
  return `${moving.type}${cap}${to}`
}

/** A pawn reaching the far rank needs a promotion choice before the move commits. */
function needsPromotion(piece: Piece, to: string): boolean {
  return piece.type === "P" && ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"))
}

/** Moves `from`→`to`, replacing whatever was on `to` (this board is a free-form
 * teaching setup, not a legality-checked game) and applying a promotion type
 * if given. */
function applyMove(pieces: Piece[], from: string, to: string, promoteTo?: PieceType): Piece[] {
  const moving = pieces.find(p => p.square === from)
  if (!moving) return pieces
  return pieces.filter(p => p.square !== to).map(p => p.id === moving.id ? { ...p, square: to, type: promoteTo ?? p.type } : p)
}

const CASTLING_ROOK_MOVES: Record<string, { from: string; to: string }> = {
  e1g1: { from: "h1", to: "f1" }, e1c1: { from: "a1", to: "d1" },
  e8g8: { from: "h8", to: "f8" }, e8c8: { from: "a8", to: "d8" },
}

/** There's no legal-move engine here, so a king moving two squares along its
 * home rank has to explicitly bring the rook along — nothing else would. */
function applyMoveWithCastling(pieces: Piece[], from: string, to: string, promoteTo?: PieceType): Piece[] {
  const moving = pieces.find(p => p.square === from)
  const castle = moving?.type === "K" ? CASTLING_ROOK_MOVES[from + to] : undefined
  const afterKing = applyMove(pieces, from, to, promoteTo)
  if (!castle) return afterKing
  const rook = afterKing.find(p => p.square === castle.from && p.type === "R" && p.color === moving!.color)
  return rook ? applyMove(afterKing, castle.from, castle.to) : afterKing
}

/** "e2e4" / "e7e8q" -> {from:"e2",to:"e4"} — promotion suffix is dropped for the arrow. */
function uciToArrow(uci: string): Arrow | null {
  if (!uci || uci.length < 4) return null
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) }
}

/** Score in centipawns/mate, from the side-to-move's perspective, -> White's perspective. */
function scoreFromWhitesView(scoreCp: number | null, mate: number | null, sideToMove: "w" | "b") {
  const flip = sideToMove === "b" ? -1 : 1
  if (mate !== null) return { mate: mate * flip, cp: null as number | null }
  return { mate: null, cp: scoreCp !== null ? scoreCp * flip : null }
}

interface ImportedGame {
  white: string
  black: string
  result: string
  moves: MoveRecord[]
}

/** Parses a pasted PGN into a move list with a FEN snapshot after every ply. */
function importPgn(pgn: string): ImportedGame | null {
  try {
    const chess = new Chess()
    chess.loadPgn(pgn)
    const verboseMoves = chess.history({ verbose: true })
    if (verboseMoves.length === 0) return null
    const headers = chess.getHeaders()
    return {
      white: headers.White ?? "White",
      black: headers.Black ?? "Black",
      result: headers.Result ?? "*",
      moves: verboseMoves.map(m => ({ notation: m.san, from: m.from, to: m.to, fen: m.after })),
    }
  } catch {
    return null
  }
}

/* ─────────────────────── Sub-Components ─────────────────── */

function ArrowLayer({ arrows, flipped }: { arrows: Arrow[]; flipped: boolean }) {
  if (!arrows.length) return null
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex:30 }}>
      <defs>
        <marker id="cls-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill="rgba(16,163,127,0.85)" />
        </marker>
      </defs>
      {arrows.map((arr, i) => {
        const a = squareToXY(arr.from, flipped); const b = squareToXY(arr.to, flipped)
        const x1=(a.x+.5)*12.5; const y1=(a.y+.5)*12.5; const x2=(b.x+.5)*12.5; const y2=(b.y+.5)*12.5
        const dx=x2-x1; const dy=y2-y1; const len=Math.sqrt(dx*dx+dy*dy); const nx=dx/len; const ny=dy/len
        return <line key={i} x1={`${x1+nx*2}%`} y1={`${y1+ny*2}%`} x2={`${x2-nx*1.5}%`} y2={`${y2-ny*1.5}%`} stroke="rgba(16,163,127,0.8)" strokeWidth="2.8%" strokeLinecap="round" markerEnd="url(#cls-ah)" />
      })}
    </svg>
  )
}

interface BoardViewProps {
  pieces: Piece[]; arrows: Arrow[]; selected: string | null
  flipped: boolean; interactive: boolean
  lastMove?: { from: string; to: string } | null
  onSquareClick: (sq: string) => void
  onMouseDown: (e: React.MouseEvent, sq: string) => void
  onMouseUp: (e: React.MouseEvent, sq: string) => void
  theme?: BoardThemeKey
  pendingPromotion?: { square: string; color: Color } | null
  onPromote?: (type: PieceType) => void
  onCancelPromotion?: () => void
}

function BoardView({ pieces, arrows, selected, flipped, interactive, lastMove, onSquareClick, onMouseDown, onMouseUp, theme = DEFAULT_BOARD_THEME, pendingPromotion, onPromote, onCancelPromotion }: BoardViewProps) {
  const colors = BOARD_THEMES[theme] ?? BOARD_THEMES[DEFAULT_BOARD_THEME]
  return (
    <div className="relative w-full" style={{ paddingBottom:"100%" }}>
      <div className="absolute inset-0 rounded-xl overflow-hidden shadow-xl" onContextMenu={e=>e.preventDefault()}>
        {Array.from({ length:64 }, (_,i) => {
          const x=i%8; const y=Math.floor(i/8)
          const sq=xyToSquare(x,y,flipped); const light=isLightAt(x,y)
          const isSel=selected===sq; const canMove=selected!==null&&pieces.some(p=>p.square===selected)
          const isLastFrom=lastMove?.from===sq; const isLastTo=lastMove?.to===sq
          return (
            <div key={sq}
              onClick={()=>interactive&&onSquareClick(sq)}
              onMouseDown={e=>interactive&&onMouseDown(e,sq)}
              onMouseUp={e=>interactive&&onMouseUp(e,sq)}
              onContextMenu={e=>e.preventDefault()}
              className={cn("absolute select-none", interactive?"cursor-pointer":"cursor-default")}
              style={{
                left:`${x*12.5}%`, top:`${y*12.5}%`, width:"12.5%", height:"12.5%", zIndex:1,
                background: light?colors.light:colors.dark,
                boxShadow: isSel
                  ? "inset 0 0 0 3px rgba(252,211,77,0.9)"
                  : canMove && !pieces.some(p=>p.square===sq)
                  ? "inset 0 0 0 2px rgba(252,211,77,0.3)"
                  : (isLastFrom||isLastTo)
                  ? "inset 0 0 0 3px rgba(99,220,159,0.6)"
                  : undefined,
              }}
            >
              {x===(flipped?7:0)&&<span style={{position:"absolute",top:1,left:2,fontSize:"min(2vw,11px)",fontWeight:700,lineHeight:1,color:light?colors.dark:colors.light,userSelect:"none",pointerEvents:"none"}}>{xyToSquare(x,y,flipped)[1]}</span>}
              {y===(flipped?0:7)&&<span style={{position:"absolute",bottom:1,right:2,fontSize:"min(2vw,11px)",fontWeight:700,lineHeight:1,color:light?colors.dark:colors.light,userSelect:"none",pointerEvents:"none"}}>{xyToSquare(x,y,flipped)[0]}</span>}
            </div>
          )
        })}
        {pieces.map(piece=>{
          const {x,y}=squareToXY(piece.square,flipped); const isSel=selected===piece.square
          const hidden = pendingPromotion?.square === piece.square
          return (
            <div key={piece.id} style={{
              position:"absolute",left:`${x*12.5}%`,top:`${y*12.5}%`,width:"12.5%",height:"12.5%",
              display:"flex",alignItems:"center",justifyContent:"center",
              transition:"left 0.12s ease,top 0.12s ease,transform 0.1s ease",
              transform:isSel?"scale(1.18)":"scale(1)",zIndex:isSel?20:10,pointerEvents:"none",
              fontSize:"min(7vw,46px)",lineHeight:1,userSelect:"none",
              opacity: hidden?0:1,
              color:piece.color==="w"?"#fffef5":"#1c1008",
              textShadow:piece.color==="w"
                ?"0 0 4px #2d1a00,0 0 3px #2d1a00,1px 1px 0 #2d1a00,-1px -1px 0 #2d1a00"
                :"0 0 3px rgba(255,255,255,0.35),1px 2px 3px rgba(0,0,0,0.45)",
              filter:isSel?"drop-shadow(0 4px 8px rgba(0,0,0,0.5))":"drop-shadow(1px 2px 3px rgba(0,0,0,0.3))",
            }}>
              {SYMBOLS[`${piece.color}${piece.type}`]??"?"}
            </div>
          )
        })}
        <ArrowLayer arrows={arrows} flipped={flipped} />
        {pendingPromotion && onPromote && (
          <PromotionPicker square={pendingPromotion.square} color={pendingPromotion.color} flipped={flipped}
            onPick={onPromote} onCancel={onCancelPromotion} />
        )}
      </div>
    </div>
  )
}

/** Floating Q/R/B/N picker shown over the promotion square; a backdrop
 * covers the board so clicking elsewhere cancels the pending move. */
function PromotionPicker({ square, color, flipped, onPick, onCancel }: {
  square: string; color: Color; flipped: boolean
  onPick: (type: PieceType) => void; onCancel?: () => void
}) {
  const { x, y } = squareToXY(square, flipped)
  // Stack the choices toward the center of the board so they never run off-edge.
  const stackDown = y === 0
  return (
    <>
      <div className="absolute inset-0 bg-black/30" style={{ zIndex:40 }} onClick={onCancel} onContextMenu={e=>e.preventDefault()} />
      <div className="absolute flex flex-col rounded-lg overflow-hidden shadow-2xl border border-black/10 bg-white"
        style={{
          left:`${x*12.5}%`, width:"12.5%", zIndex:50,
          top: stackDown ? `${y*12.5}%` : undefined,
          bottom: stackDown ? undefined : `${(7-y)*12.5}%`,
          flexDirection: stackDown ? "column" : "column-reverse",
        }}>
        {PROMOTION_CHOICES.map(type=>(
          <button key={type} type="button" onClick={()=>onPick(type)}
            className="aspect-square flex items-center justify-center bg-white hover:bg-amber-100 transition-colors"
            style={{ fontSize:"min(6vw,38px)", lineHeight:1, color: color==="w"?"#1c1008":"#1c1008" }}>
            {SYMBOLS[`${color}${type}`]}
          </button>
        ))}
      </div>
    </>
  )
}

/** Small popover letting either coach or student pick their own board
 * look — a personal display preference (localStorage), not something
 * broadcast to the other party. */
function BoardThemePicker({ current, open, onToggle, onPick }: {
  current: BoardThemeKey; open: boolean; onToggle: () => void; onPick: (key: BoardThemeKey) => void
}) {
  return (
    <div className="relative">
      <button type="button" onClick={onToggle}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
        <Palette className="size-3.5"/>Board
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-48 rounded-xl border border-zinc-200 bg-white shadow-lg p-1.5">
          {Object.entries(BOARD_THEMES).map(([key, t]) => (
            <button key={key} type="button" onClick={()=>onPick(key as BoardThemeKey)}
              className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-medium text-left transition-colors",
                current===key?"bg-teal-50 text-teal-800":"hover:bg-zinc-50 text-zinc-700")}>
              <span className="flex rounded overflow-hidden border border-black/10 shrink-0" style={{width:20,height:20}}>
                <span style={{width:10,height:20,background:t.light}}/>
                <span style={{width:10,height:20,background:t.dark}}/>
              </span>
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniBoard({ fen, size=96 }: { fen:string; size?:number }) {
  const pieces=parseFen(fen); const sq=size/8
  return (
    <div style={{width:size,height:size,position:"relative",borderRadius:6,overflow:"hidden",flexShrink:0}}>
      {Array.from({length:64},(_,i)=>{const x=i%8;const y=Math.floor(i/8);return<div key={i} style={{position:"absolute",left:x*sq,top:y*sq,width:sq,height:sq,background:isLightAt(x,y)?"#f0d9b5":"#b58863"}}/>})}
      {pieces.map(p=>{const{x,y}=squareToXY(p.square,false);return<div key={p.id} style={{position:"absolute",left:x*sq,top:y*sq,width:sq,height:sq,display:"flex",alignItems:"center",justifyContent:"center",fontSize:sq*0.72,lineHeight:1,color:p.color==="w"?"#fffef5":"#1c1008",textShadow:p.color==="w"?"0 0 3px #2d1a00,1px 1px 0 #2d1a00":"0 0 2px rgba(255,255,255,0.3)",userSelect:"none"}}>{SYMBOLS[`${p.color}${p.type}`]}</div>})}
    </div>
  )
}

/* ─────────────────────── Props ──────────────────────────── */

interface Props {
  sessionId:     string
  deliveryMode:  string
  joinLink:      string | null
  videoQuality?: "performance" | "balanced" | "data_saver"
  initialFen:    string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialArrows: any[]
  role:          "coach" | "student"
  userName:      string
  userId:        string
  readonly:      boolean
  apiPath?:      string
  isCoach?:      boolean
}

/* ─────────────────────── Main Component ─────────────────── */

export default function ClassroomLive({
  sessionId, deliveryMode, joinLink, videoQuality = "performance",
  initialFen = STARTING_FEN, initialArrows = [],
  role, userName, userId, readonly,
  apiPath, isCoach,
}: Props) {
  const supabase   = useMemo(()=>createClient(),[])
  const channelRef = useRef<RealtimeChannel|null>(null)

  /* ── Coach board ── */
  const [coachPieces,    setCoachPieces]    = useState<Piece[]>(()=>parseFen(initialFen))
  const [coachArrows,    setCoachArrows]    = useState<Arrow[]>(initialArrows as Arrow[])
  const [coachSelected,  setCoachSelected]  = useState<string|null>(null)
  const [coachArrowFrom, setCoachArrowFrom] = useState<string|null>(null)
  const [coachFlipped,   setCoachFlipped]   = useState(false)
  const [coachFenInput,  setCoachFenInput]  = useState(initialFen)
  const [saving,         setSaving]         = useState(false)
  const [coachLastMove,  setCoachLastMove]  = useState<{from:string;to:string}|null>(null)
  const [coachPendingPromotion, setCoachPendingPromotion] = useState<{from:string;to:string;color:Color}|null>(null)
  const coachFenRef = useRef(initialFen)

  /* ── Board theme (personal display preference, not classroom state) ── */
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>(DEFAULT_BOARD_THEME)
  const [showThemePicker, setShowThemePicker] = useState(false)
  useEffect(() => {
    // localStorage doesn't exist during SSR — the saved theme must be
    // hydrated post-mount, the standard pattern for browser-storage state.
    const saved = window.localStorage.getItem(BOARD_THEME_STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved && saved in BOARD_THEMES) setBoardTheme(saved as BoardThemeKey)
  }, [])
  function changeBoardTheme(next: BoardThemeKey) {
    setBoardTheme(next)
    window.localStorage.setItem(BOARD_THEME_STORAGE_KEY, next)
  }

  /* ── Move history (coach) ── */
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([])
  const [historyIdx,  setHistoryIdx]  = useState(-1)  // -1 = live position
  const moveListRef = useRef<HTMLDivElement>(null)

  /* ── PGN import (coach) ── */
  const [showPgnImport, setShowPgnImport] = useState(false)
  const [pgnInput,      setPgnInput]      = useState("")
  const [importedGame,  setImportedGame]  = useState<ImportedGame | null>(null)

  /* ── Live engine analysis (coach) ── */
  const [showAnalysis, setShowAnalysis] = useState(false)
  const engine = useStockfish()

  /* ── Annotation ── */
  const [annotation,      setAnnotation]      = useState("")
  const [editAnnotation,  setEditAnnotation]  = useState("")
  const [showAnnotation,  setShowAnnotation]  = useState(true)

  /* ── Challenge mode ── */
  const [challengeText,    setChallengeText]    = useState("")
  const [challengeCorrect, setChallengeCorrect] = useState("")   // correct move hint e.g. "e4"
  const [challengeTargetFen, setChallengeTargetFen] = useState("") // FEN of correct answer
  const [challengeExplain, setChallengeExplain] = useState("")
  const [activeChallenge,  setActiveChallenge]  = useState<Challenge|null>(null)
  const [showReveal,       setShowReveal]       = useState(false)

  /* ── Student sandbox ── */
  const [sandboxPieces,    setSandboxPieces]    = useState<Piece[]>(()=>parseFen(initialFen))
  const [sandboxArrows,    setSandboxArrows]    = useState<Arrow[]>([])
  const [sandboxSelected,  setSandboxSelected]  = useState<string|null>(null)
  const [sandboxArrowFrom, setSandboxArrowFrom] = useState<string|null>(null)
  const [sandboxFlipped,   setSandboxFlipped]   = useState(false)
  const [sandboxLastMove,  setSandboxLastMove]  = useState<{from:string;to:string}|null>(null)
  const [sandboxPendingPromotion, setSandboxPendingPromotion] = useState<{from:string;to:string;color:Color}|null>(null)
  const [answerResult,     setAnswerResult]     = useState<"correct"|"wrong"|null>(null)
  const sandboxFenRef  = useRef(initialFen)
  const sandboxLastRef = useRef("")  // last move notation

  /* ── Raise hand ── */
  const [handRaised,  setHandRaised]  = useState(false)
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([])

  /* ── Chat ── */
  const [messages,  setMessages]  = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [sending,   setSending]   = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  /* ── Student answers (coach) ── */
  const [answers, setAnswers] = useState<AnswerSub[]>([])

  /* ── Connection state ── */
  // Supabase Realtime heartbeats every 25 s; server marks client gone after ~10 s of silence.
  // A Wi-Fi → mobile switch drops the WebSocket; the SDK auto-reconnects but the component
  // must surface the gap so students/coaches know moves may have been missed.
  const [realtimeOk, setRealtimeOk] = useState(true)

  /* ── Realtime ── */
  useEffect(()=>{
    const ch = supabase.channel(`classroom:${sessionId}`,{config:{broadcast:{self:false}}})

    // Coach board sync
    ch.on("broadcast",{event:"board_update"},({payload})=>{
      if(role==="student"){
        const {fen,arrows:arr,annotation:ann}=payload as {fen:string;arrows:Arrow[];annotation?:string}
        setCoachPieces(parseFen(fen)); setCoachArrows(arr??[]); coachFenRef.current=fen; setCoachFenInput(fen)
        if(ann!==undefined) setAnnotation(ann)
      }
    })

    // Challenge set by coach
    ch.on("broadcast",{event:"challenge_set"},({payload})=>{
      const c=payload as Challenge
      setActiveChallenge(c); setShowReveal(false); setAnswerResult(null)
      if(role==="student"){
        setSandboxPieces(parseFen(c.fen)); sandboxFenRef.current=c.fen
        setSandboxArrows([]); setSandboxSelected(null); setSandboxLastMove(null)
        toast("📋 New challenge from coach!")
      }
    })

    ch.on("broadcast",{event:"challenge_clear"},()=>{
      setActiveChallenge(null); setShowReveal(false)
    })

    ch.on("broadcast",{event:"challenge_reveal"},({payload})=>{
      const {explanation}=payload as {explanation:string}
      setShowReveal(true)
      if(role==="student") toast(`Coach revealed solution: ${explanation||"Check the board!"}`)
    })

    // Student answers
    ch.on("broadcast",{event:"answer_submit"},({payload})=>{
      if(role==="coach"){
        const sub=payload as AnswerSub
        setAnswers(prev=>[...prev.filter(a=>a.studentId!==sub.studentId),sub])
      }
    })

    // Raise hand
    ch.on("broadcast",{event:"hand_raise"},({payload})=>{
      const {studentId,studentName,raised}=payload as {studentId:string;studentName:string;raised:boolean}
      if(role==="coach"){
        setRaisedHands(prev=>raised
          ?prev.some(h=>h.studentId===studentId)?prev:[...prev,{studentId,studentName}]
          :prev.filter(h=>h.studentId!==studentId)
        )
      }
    })

    // Chat
    ch.on("broadcast",{event:"chat"},({payload})=>{
      const msg=payload as ChatMsg
      setMessages(prev=>prev.some(m=>m.id===msg.id)?prev:[...prev,msg])
    })

    ch.subscribe((status) => {
      // SUBSCRIBED = connected or reconnected; CHANNEL_ERROR/CLOSED = dropped
      if (status === "SUBSCRIBED") setRealtimeOk(true)
      if (status === "CHANNEL_ERROR" || status === "CLOSED") setRealtimeOk(false)
    })
    channelRef.current=ch

    // Load chat history
    supabase.from("classroom_messages").select("id,sender_name,sender_role,content,created_at").eq("session_id",sessionId).order("created_at",{ascending:true})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({data}:{data:any})=>{
        if(data) setMessages(data.map((m:{id:string;sender_name:string;sender_role:string;content:string;created_at:string})=>({id:m.id,senderName:m.sender_name,senderRole:m.sender_role as "coach"|"student",content:m.content,at:m.created_at})))
      })

    return ()=>{ ch.unsubscribe() }
  },[sessionId,role,supabase])

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[messages])
  useEffect(()=>{ if(moveListRef.current) moveListRef.current.scrollLeft=999999 },[moveHistory])

  /* ── Board broadcast ── */
  const broadcastBoard = useCallback((pieces:Piece[],arrows:Arrow[],ann?:string)=>{
    const fen=piecesToFen(pieces); coachFenRef.current=fen
    channelRef.current?.send({type:"broadcast",event:"board_update",payload:{fen,arrows,annotation:ann??annotation}})
  },[annotation])

  /* ── Coach board click ── */
  function handleCoachClick(sq:string){
    if(readonly||role!=="coach"||historyIdx!==-1) return
    const piece=coachPieces.find(p=>p.square===sq)
    if(!coachSelected){if(piece) setCoachSelected(sq); return}
    if(coachSelected===sq){setCoachSelected(null); return}
    const moving=coachPieces.find(p=>p.square===coachSelected)
    if(!moving){setCoachSelected(null); return}
    // Clicking another of your own pieces re-selects it rather than
    // "capturing" it — this is a free-form setup board, not a legality-
    // checked game, so nothing stops an accidental own-piece click otherwise.
    if(piece&&piece.color===moving.color){setCoachSelected(sq); return}
    if(needsPromotion(moving,sq)){setCoachPendingPromotion({from:coachSelected,to:sq,color:moving.color}); setCoachSelected(null); return}
    commitCoachMove(coachSelected,sq)
  }

  function commitCoachMove(from:string,to:string,promoteTo?:PieceType){
    const moving=coachPieces.find(p=>p.square===from)
    if(!moving) return
    const notation=getMoveNotation(moving,from,to,coachPieces)+(promoteTo?`=${promoteTo}`:"")
    const next=applyMoveWithCastling(coachPieces,from,to,promoteTo)
    const nextFen=piecesToFen(next)
    setCoachPieces(next); setCoachSelected(null); setCoachLastMove({from,to})
    setMoveHistory(prev=>[...prev,{notation,from,to,fen:nextFen}])
    setHistoryIdx(-1)
    broadcastBoard(next,coachArrows)
  }

  function resolveCoachPromotion(type:PieceType){
    if(!coachPendingPromotion) return
    commitCoachMove(coachPendingPromotion.from,coachPendingPromotion.to,type)
    setCoachPendingPromotion(null)
  }

  function handleCoachMouseDown(e:React.MouseEvent,sq:string){if(e.button===2){e.preventDefault();setCoachArrowFrom(sq)}}
  function handleCoachMouseUp(e:React.MouseEvent,sq:string){
    if(e.button!==2||!coachArrowFrom) return
    const next=coachArrowFrom===sq
      ?coachArrows.filter(a=>a.from!==sq&&a.to!==sq)
      :coachArrows.some(a=>a.from===coachArrowFrom&&a.to===sq)
        ?coachArrows.filter(a=>!(a.from===coachArrowFrom&&a.to===sq))
        :[...coachArrows,{from:coachArrowFrom,to:sq}]
    setCoachArrows(next); setCoachArrowFrom(null)
    if(role==="coach") broadcastBoard(coachPieces,next)
  }

  /* ── History navigation ── */
  function navHistory(idx:number){
    const target=idx===-1?coachFenRef.current:moveHistory[idx].fen
    const ps=parseFen(target); setCoachPieces(ps); setHistoryIdx(idx)
    if(idx>=0) setCoachLastMove({from:moveHistory[idx].from,to:moveHistory[idx].to})
    else setCoachLastMove(null)
  }

  function broadcastHistoricalPosition(){
    const fen=historyIdx===-1?coachFenRef.current:moveHistory[historyIdx].fen
    const ps=parseFen(fen); setCoachPieces(ps); setHistoryIdx(-1)
    broadcastBoard(ps,coachArrows)
    toast("Position broadcast to students")
  }

  /* ── Load FEN ── */
  function loadFen(fen:string){
    const t=fen.trim(); if(!t) return
    const ps=parseFen(t); setCoachPieces(ps); setCoachArrows([]); setCoachFenInput(t)
    coachFenRef.current=piecesToFen(ps); setCoachSelected(null); setHistoryIdx(-1)
    if(role==="coach") broadcastBoard(ps,[])
  }

  /* ── PGN import ── */
  function handleImportPgn() {
    const game = importPgn(pgnInput)
    if (!game) { toast.error("Couldn't parse that PGN — check the format and try again."); return }
    setImportedGame(game)
    setMoveHistory(game.moves)
    setHistoryIdx(-1)
    const finalFen = game.moves[game.moves.length - 1].fen
    const ps = parseFen(finalFen)
    setCoachPieces(ps); coachFenRef.current = finalFen; setCoachFenInput(finalFen)
    setCoachArrows([]); setCoachSelected(null)
    if (role === "coach") broadcastBoard(ps, [])
    setShowPgnImport(false); setPgnInput("")
    toast.success(`Imported ${game.white} vs ${game.black} — ${game.moves.length} moves`)
  }

  /* ── Live engine analysis ── */
  // Derived from render-safe state (coachPieces), not the coachFenRef ref, since
  // reading a ref's .current during the render body (rather than inside an effect
  // or handler) breaks React's render-purity rules.
  const currentFenForAnalysis = historyIdx === -1 ? piecesToFen(coachPieces) : moveHistory[historyIdx]?.fen ?? piecesToFen(coachPieces)
  useEffect(() => {
    if (!showAnalysis || !engine.ready || role !== "coach") return
    engine.analyze(currentFenForAnalysis, 16)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnalysis, engine.ready, currentFenForAnalysis])

  const analysisArrow = engine.bestMoveUci ? uciToArrow(engine.bestMoveUci) : null
  const sideToMove: "w" | "b" = currentFenForAnalysis.split(" ")[1] === "b" ? "b" : "w"
  const whiteScore = engine.line ? scoreFromWhitesView(engine.line.scoreCp, engine.line.mate, sideToMove) : null

  /* ── Save board ── */
  async function saveBoard(){
    if(!sessionId||role!=="coach") return; setSaving(true)
    try{
      const path = apiPath ?? `/api/sessions/${sessionId}/classroom`
      const res=await fetch(path,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({board_fen:coachFenRef.current,board_arrows:coachArrows})})
      if(!res.ok){toast.error("Save failed");return}; toast.success("Board saved")
    }finally{setSaving(false)}
  }

  async function endSession(){
    if(!confirm("End this session for everyone?")) return
    const res=await fetch(`/api/sessions/${sessionId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"completed"})})
    if(!res.ok){toast.error("Could not end session");return}
    toast.success("Session ended")
    window.location.href="/coach/sessions"
  }

  /* ── Send challenge ── */
  function sendChallenge(){
    if(!challengeText.trim()) return
    const challenge:Challenge={
      text:        challengeText.trim(),
      fen:         coachFenRef.current,
      correctMoves:[challengeCorrect.trim()].filter(Boolean),
      targetFen:   challengeTargetFen.trim(),
      explanation: challengeExplain.trim(),
    }
    channelRef.current?.send({type:"broadcast",event:"challenge_set",payload:challenge})
    setActiveChallenge(challenge)
    setChallengeText(""); setChallengeCorrect(""); setChallengeTargetFen(""); setChallengeExplain("")
    toast.success("Challenge sent to all students!")
  }

  function clearChallenge(){
    channelRef.current?.send({type:"broadcast",event:"challenge_clear",payload:{}})
    setActiveChallenge(null); setAnswers([])
  }

  function revealSolution(){
    channelRef.current?.send({type:"broadcast",event:"challenge_reveal",payload:{explanation:activeChallenge?.explanation??""}})
    setShowReveal(true)
    if(activeChallenge?.targetFen){ const ps=parseFen(activeChallenge.targetFen); setCoachPieces(ps); broadcastBoard(ps,coachArrows) }
  }

  /* ── Student sandbox ── */
  function handleSandboxClick(sq:string){
    const piece=sandboxPieces.find(p=>p.square===sq)
    if(!sandboxSelected){if(piece) setSandboxSelected(sq); return}
    if(sandboxSelected===sq){setSandboxSelected(null); return}
    const moving=sandboxPieces.find(p=>p.square===sandboxSelected)
    if(!moving){setSandboxSelected(null); return}
    if(piece&&piece.color===moving.color){setSandboxSelected(sq); return}
    if(needsPromotion(moving,sq)){setSandboxPendingPromotion({from:sandboxSelected,to:sq,color:moving.color}); setSandboxSelected(null); return}
    commitSandboxMove(sandboxSelected,sq)
  }

  function commitSandboxMove(from:string,to:string,promoteTo?:PieceType){
    const moving=sandboxPieces.find(p=>p.square===from)
    if(!moving) return
    const notation=getMoveNotation(moving,from,to,sandboxPieces)+(promoteTo?`=${promoteTo}`:"")
    const next=applyMoveWithCastling(sandboxPieces,from,to,promoteTo)
    setSandboxPieces(next); sandboxFenRef.current=piecesToFen(next)
    sandboxLastRef.current=notation; setSandboxSelected(null)
    setSandboxLastMove({from,to}); setAnswerResult(null)
  }

  function resolveSandboxPromotion(type:PieceType){
    if(!sandboxPendingPromotion) return
    commitSandboxMove(sandboxPendingPromotion.from,sandboxPendingPromotion.to,type)
    setSandboxPendingPromotion(null)
  }
  function handleSandboxMouseDown(e:React.MouseEvent,sq:string){if(e.button===2){e.preventDefault();setSandboxArrowFrom(sq)}}
  function handleSandboxMouseUp(e:React.MouseEvent,sq:string){
    if(e.button!==2||!sandboxArrowFrom) return
    setSandboxArrows(prev=>sandboxArrowFrom===sq?prev.filter(a=>a.from!==sq&&a.to!==sq):prev.some(a=>a.from===sandboxArrowFrom&&a.to===sq)?prev.filter(a=>!(a.from===sandboxArrowFrom&&a.to===sq)):[...prev,{from:sandboxArrowFrom,to:sq}])
    setSandboxArrowFrom(null)
  }
  function syncSandbox(){ const f=coachFenRef.current; setSandboxPieces(parseFen(f)); setSandboxArrows([]); sandboxFenRef.current=f; setSandboxSelected(null); setSandboxLastMove(null); setAnswerResult(null); toast("Synced to coach position") }

  /* ── Submit answer ── */
  function submitAnswer(){
    const submittedFen=sandboxFenRef.current
    const lastMove=sandboxLastRef.current

    // Validate against challenge if active and has targetFen
    let isCorrect:boolean|null=null
    if(activeChallenge){
      if(activeChallenge.targetFen) isCorrect=fenPosition(submittedFen)===fenPosition(activeChallenge.targetFen)
      else if(activeChallenge.correctMoves.length>0) isCorrect=activeChallenge.correctMoves.map(m=>m.toLowerCase()).includes(lastMove.toLowerCase())
    }
    if(isCorrect===true) setAnswerResult("correct")
    else if(isCorrect===false) setAnswerResult("wrong")

    const sub:AnswerSub={studentId:userId,studentName:userName,fen:submittedFen,lastMove,isCorrect,at:new Date().toISOString()}
    channelRef.current?.send({type:"broadcast",event:"answer_submit",payload:sub})
    supabase.from("classroom_messages").insert({session_id:sessionId,sender_id:userId,sender_name:userName,sender_role:"student",content:`Submitted answer: ${lastMove||"(position)"}`,message_type:"answer",answer_fen:submittedFen})
    if(isCorrect===null) toast.success("Answer submitted to coach!")
    else if(isCorrect) toast.success("✓ Correct! Well done!")
    else toast.error("✗ Not quite — try again or wait for coach to reveal")
  }

  /* ── Raise hand ── */
  function toggleHand(){
    const next=!handRaised; setHandRaised(next)
    channelRef.current?.send({type:"broadcast",event:"hand_raise",payload:{studentId:userId,studentName:userName,raised:next}})
    if(next) toast("Hand raised — coach will call on you"); else toast("Hand lowered")
  }
  function dismissHand(studentId:string){
    setRaisedHands(prev=>prev.filter(h=>h.studentId!==studentId))
    channelRef.current?.send({type:"broadcast",event:"hand_raise",payload:{studentId,studentName:"",raised:false}})
  }

  /* ── Annotation ── */
  function saveAnnotation(){
    const ann=editAnnotation.trim(); setAnnotation(ann)
    broadcastBoard(coachPieces,coachArrows,ann)
    toast.success(ann?"Annotation broadcast to students":"Annotation cleared")
  }

  /* ── Chat ── */
  async function sendChat(){
    const content=chatInput.trim(); if(!content||sending) return
    setSending(true)
    const msg:ChatMsg={id:crypto.randomUUID(),senderName:userName,senderRole:role,content,at:new Date().toISOString()}
    setMessages(prev=>[...prev,msg]); setChatInput("")
    channelRef.current?.send({type:"broadcast",event:"chat",payload:msg})
    await supabase.from("classroom_messages").insert({session_id:sessionId,sender_id:userId,sender_name:userName,sender_role:role,content,message_type:"chat"})
    setSending(false)
  }

  /* ── Jitsi / Zoom ── */
  const jitsiUrl = deliveryMode==="jitsi"
    ? (joinLink?.includes("meet.jit.si")?joinLink:`https://meet.jit.si/ChessConnect-${sessionId.replace(/-/g,"").substring(0,12)}`)
    : null
  const zoomUrl = deliveryMode==="zoom"&&joinLink?.startsWith("https://")?joinLink:null

  const isLive = historyIdx===-1
  const displayPieces = coachPieces
  const displayLastMove = historyIdx===-1?coachLastMove:(moveHistory[historyIdx]?{from:moveHistory[historyIdx].from,to:moveHistory[historyIdx].to}:null)

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <div className="space-y-4">

      {/* ── Network disconnection banner ─────────────────────────────────────
          Supabase Realtime heartbeats every 25 s; the server considers a
          client gone after ~10 s of silence. A Wi-Fi → mobile switch drops
          the underlying WebSocket. The SDK auto-reconnects, but until it does
          the student may miss board updates sent by the coach. This banner
          surfaces that gap so both parties know to hold until reconnected.
          ──────────────────────────────────────────────────────────────────── */}
      {!realtimeOk && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-[13px] text-amber-800">
          <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span>
            <strong>Connection interrupted</strong> — live board updates are paused.
            Reconnecting automatically…
          </span>
        </div>
      )}

      {/* ── Challenge banner (students / coach both see) ── */}
      {activeChallenge && (
        <div className={cn(
          "rounded-2xl border-2 p-4",
          showReveal?"border-emerald-300 bg-emerald-50":"border-amber-300 bg-amber-50"
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0",showReveal?"bg-emerald-600":"bg-amber-500")}>
                {showReveal?<CheckCircle2 className="size-4 text-white"/>:<Trophy className="size-4 text-white"/>}
              </div>
              <div>
                <p className={cn("text-[13px] font-black",showReveal?"text-emerald-900":"text-amber-900")}>
                  {showReveal?"Solution Revealed":"Coach Challenge"}
                </p>
                <p className={cn("text-[13px] mt-0.5",showReveal?"text-emerald-800":"text-amber-800")}>
                  {activeChallenge.text}
                </p>
                {showReveal&&activeChallenge.explanation&&(
                  <p className="text-[12px] text-emerald-700 mt-1 font-medium">{activeChallenge.explanation}</p>
                )}
                {!showReveal&&activeChallenge.correctMoves.length>0&&role==="coach"&&(
                  <p className="text-[11px] text-amber-600 mt-0.5">Correct: {activeChallenge.correctMoves.join(", ")}</p>
                )}
              </div>
            </div>
            {role==="coach"&&(
              <div className="flex items-center gap-2 shrink-0">
                {!showReveal&&(
                  <button type="button" onClick={revealSolution}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors">
                    <Eye className="size-3.5"/> Reveal
                  </button>
                )}
                <button type="button" onClick={clearChallenge}
                  className="size-7 rounded-lg border border-amber-300 flex items-center justify-center text-amber-600 hover:bg-amber-100 transition-colors">
                  <X className="size-3.5"/>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Answer result feedback (students) ── */}
      {role==="student"&&answerResult&&(
        <div className={cn("rounded-2xl border-2 p-3 flex items-center gap-3",answerResult==="correct"?"border-emerald-300 bg-emerald-50":"border-red-300 bg-red-50")}>
          <div className={cn("size-8 rounded-full flex items-center justify-center",answerResult==="correct"?"bg-emerald-500":"bg-red-500")}>
            {answerResult==="correct"?<CheckCircle2 className="size-4 text-white"/>:<X className="size-4 text-white"/>}
          </div>
          <div>
            <p className={cn("text-[13px] font-black",answerResult==="correct"?"text-emerald-800":"text-red-800")}>
              {answerResult==="correct"?"Correct! Excellent move!":"Not quite — try again or wait for the reveal"}
            </p>
          </div>
          <button type="button" onClick={()=>setAnswerResult(null)} className="ml-auto text-zinc-400 hover:text-zinc-600">
            <X className="size-4"/>
          </button>
        </div>
      )}

      {/* ── Main grid: board + right panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* ── LEFT: Chess boards ── */}
        <div className="lg:col-span-3 space-y-3">

          {/* Board header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">
                {role==="coach"?"Live Board":"Coach Board"}
              </p>
              {historyIdx!==-1&&(
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                  History [{historyIdx+1}/{moveHistory.length}]
                </span>
              )}
            </div>
            {role==="student"&&(
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"/>Live sync
              </span>
            )}
          </div>

          {/* Coach board */}
          <BoardView
            pieces={displayPieces}
            arrows={showAnalysis && analysisArrow ? [...coachArrows, analysisArrow] : coachArrows}
            selected={coachSelected}
            flipped={coachFlipped} interactive={role==="coach"&&!readonly&&isLive}
            lastMove={displayLastMove}
            onSquareClick={handleCoachClick}
            onMouseDown={handleCoachMouseDown}
            onMouseUp={handleCoachMouseUp}
            theme={boardTheme}
            pendingPromotion={coachPendingPromotion ? { square: coachPendingPromotion.to, color: coachPendingPromotion.color } : null}
            onPromote={resolveCoachPromotion}
            onCancelPromotion={()=>setCoachPendingPromotion(null)}
          />

          {/* Live engine analysis (coach only) */}
          {role==="coach"&&showAnalysis&&(
            <div className="rounded-xl border border-zinc-200 bg-zinc-900 p-3 text-white">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <Cpu className="size-3.5"/>Stockfish 18
                </span>
                {!engine.ready?(
                  <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Loader2 className="size-3 animate-spin"/>Loading engine…</span>
                ):engine.thinking?(
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400"><Loader2 className="size-3 animate-spin"/>Depth {engine.line?.depth??0}</span>
                ):(
                  <span className="text-[11px] text-zinc-500">Depth {engine.line?.depth??0}</span>
                )}
              </div>
              {whiteScore&&(
                <div className="flex items-center gap-3">
                  {/* Eval bar: 0-100% white share, clamped */}
                  <div className="relative h-2.5 flex-1 rounded-full overflow-hidden bg-zinc-700">
                    <div className="absolute inset-y-0 left-0 bg-white transition-all duration-300"
                      style={{width:`${whiteScore.mate!==null?(whiteScore.mate>0?96:4):Math.min(96,Math.max(4,50+((whiteScore.cp??0)/12)))}%`}}
                    />
                  </div>
                  <span className="text-[13px] font-black tabular-nums w-14 text-right">
                    {whiteScore.mate!==null?`#${Math.abs(whiteScore.mate)}`:whiteScore.cp!==null?`${whiteScore.cp>0?"+":""}${(whiteScore.cp/100).toFixed(1)}`:"—"}
                  </span>
                </div>
              )}
              {engine.bestMoveUci&&(
                <p className="mt-2 text-[12px] text-zinc-300">
                  Best: <span className="font-mono font-bold text-white">{engine.bestMoveUci}</span>
                  {engine.line&&engine.line.pvUci.length>1&&(
                    <span className="text-zinc-500"> · {engine.line.pvUci.slice(0,5).join(" ")}</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Annotation display (all see current annotation) */}
          {annotation&&showAnnotation&&(
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <Lightbulb className="size-3.5 text-blue-500 shrink-0 mt-0.5"/>
              <p className="text-[12px] text-blue-800 leading-snug flex-1">{annotation}</p>
              <button type="button" onClick={()=>setShowAnnotation(false)} className="text-blue-300 hover:text-blue-500"><X className="size-3.5"/></button>
            </div>
          )}

          {/* Coach controls */}
          {role==="coach"&&!readonly&&(
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button type="button" onClick={()=>setCoachFlipped(f=>!f)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <FlipHorizontal2 className="size-3.5"/>Flip
                </button>
                <BoardThemePicker current={boardTheme} open={showThemePicker} onToggle={()=>setShowThemePicker(v=>!v)}
                  onPick={key=>{changeBoardTheme(key);setShowThemePicker(false)}} />
                <button type="button" onClick={()=>{setCoachArrows([]);broadcastBoard(coachPieces,[])}}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <Trash2 className="size-3.5"/>Clear Arrows
                </button>
                <button type="button" onClick={()=>{const ps=parseFen(STARTING_FEN);setCoachPieces(ps);setCoachArrows([]);setCoachFenInput(STARTING_FEN);setMoveHistory([]);setHistoryIdx(-1);broadcastBoard(ps,[])}}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <RotateCcw className="size-3.5"/>Reset
                </button>
                <button type="button" onClick={()=>{navigator.clipboard.writeText(coachFenRef.current);toast.success("FEN copied")}}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <Copy className="size-3.5"/>Copy FEN
                </button>
                <button type="button" onClick={()=>setShowPgnImport(v=>!v)}
                  className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors",
                    showPgnImport?"border-teal-300 bg-teal-50 text-teal-700":"border-zinc-200 text-zinc-600 hover:bg-zinc-50")}>
                  <Upload className="size-3.5"/>Import PGN
                </button>
                <button type="button" onClick={()=>setShowAnalysis(v=>!v)}
                  className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors",
                    showAnalysis?"border-emerald-300 bg-emerald-50 text-emerald-700":"border-zinc-200 text-zinc-600 hover:bg-zinc-50")}>
                  <Cpu className="size-3.5"/>Analyze
                </button>
                <button type="button" onClick={saveBoard} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50">
                  <Save className="size-3.5"/>{saving?"Saving…":"Save"}
                </button>
                <button type="button" onClick={endSession}
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-semibold transition-colors">
                  End Session
                </button>
              </div>

              {/* FEN loader */}
              <div className="flex gap-2">
                <input type="text" value={coachFenInput} onChange={e=>setCoachFenInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadFen(coachFenInput)} placeholder="Paste FEN and press Enter" className="flex-1 h-9 rounded-xl border border-input bg-transparent px-3 text-[12px] font-mono text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-ring"/>
                <button type="button" onClick={()=>loadFen(coachFenInput)} className="px-4 h-9 rounded-xl bg-zinc-900 text-white text-[12px] font-semibold hover:bg-zinc-800 transition-colors">Load</button>
              </div>

              {/* PGN import */}
              {showPgnImport&&(
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-2">
                  <textarea
                    value={pgnInput} onChange={e=>setPgnInput(e.target.value)} rows={4}
                    placeholder={'Paste a full game, e.g.\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...'}
                    className="w-full rounded-lg border border-teal-300 bg-white px-3 py-2 text-[12px] font-mono placeholder:text-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    {importedGame?(
                      <p className="text-[11px] text-teal-700">Loaded: {importedGame.white} vs {importedGame.black} ({importedGame.result})</p>
                    ):<span/>}
                    <button type="button" onClick={handleImportPgn} disabled={!pgnInput.trim()}
                      className="px-4 h-8 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-40">
                      Import Game
                    </button>
                  </div>
                </div>
              )}

              {/* Annotation editor */}
              <div className="flex gap-2">
                <input type="text" value={editAnnotation} onChange={e=>setEditAnnotation(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveAnnotation()} placeholder="Add a note for this position… (press Enter)" className="flex-1 h-9 rounded-xl border border-input bg-transparent px-3 text-[12px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                <button type="button" onClick={saveAnnotation} className="px-3 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold transition-colors">
                  <Lightbulb className="size-3.5"/>
                </button>
              </div>
            </div>
          )}

          {/* Move history */}
          {(moveHistory.length>0||role==="coach")&&(
            <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Move History</p>
                {historyIdx!==-1&&role==="coach"&&(
                  <button type="button" onClick={broadcastHistoricalPosition}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-600 text-white text-[10px] font-bold hover:bg-teal-700 transition-colors">
                    <Zap className="size-3"/>Broadcast this
                  </button>
                )}
              </div>
              {moveHistory.length===0?(
                <p className="text-[11px] text-zinc-400">Moves will appear here as coach plays</p>
              ):(
                <>
                  <div ref={moveListRef} className="flex items-center gap-1 overflow-x-auto pb-1">
                    {Array.from({length:Math.ceil(moveHistory.length/2)},(_,i)=>{
                      const wi=i*2; const bi=i*2+1
                      return (
                        <div key={i} className="flex items-center gap-0.5 shrink-0">
                          <span className="text-[10px] text-zinc-400 w-5 text-right">{i+1}.</span>
                          <button type="button" onClick={()=>navHistory(wi)}
                            className={cn("px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors",historyIdx===wi?"bg-zinc-800 text-white":"hover:bg-zinc-200 text-zinc-700")}>
                            {moveHistory[wi].notation}
                          </button>
                          {moveHistory[bi]&&(
                            <button type="button" onClick={()=>navHistory(bi)}
                              className={cn("px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors",historyIdx===bi?"bg-zinc-800 text-white":"hover:bg-zinc-200 text-zinc-700")}>
                              {moveHistory[bi].notation}
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <button type="button" onClick={()=>navHistory(-1)}
                      className={cn("px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors shrink-0 ml-1",historyIdx===-1?"bg-teal-600 text-white":"hover:bg-zinc-200 text-teal-600")}>
                      Live
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={()=>navHistory(0)} disabled={historyIdx===0||moveHistory.length===0} className="size-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 transition-colors"><ChevronsLeft className="size-3.5"/></button>
                    <button type="button" onClick={()=>navHistory(Math.max(0,(historyIdx===-1?moveHistory.length:historyIdx)-1))} disabled={historyIdx===0||moveHistory.length===0} className="size-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 transition-colors"><ChevronLeft className="size-3.5"/></button>
                    <button type="button" onClick={()=>navHistory(Math.min(moveHistory.length-1,(historyIdx===-1?moveHistory.length-1:historyIdx)+1))} disabled={historyIdx===moveHistory.length-1||historyIdx===-1} className="size-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 transition-colors"><ChevronRight className="size-3.5"/></button>
                    <button type="button" onClick={()=>navHistory(-1)} disabled={historyIdx===-1} className="size-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 transition-colors"><ChevronsRight className="size-3.5"/></button>
                    <span className="text-[11px] text-zinc-400 ml-1">{historyIdx===-1?"Live":`Move ${historyIdx+1}/${moveHistory.length}`}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Student sandbox */}
          {role==="student"&&!readonly&&(
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">
                  {activeChallenge?"Your Answer Board":"Your Practice Board"}
                </p>
                <button type="button" onClick={syncSandbox}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] font-semibold text-zinc-500 hover:bg-zinc-50 transition-colors">
                  <RefreshCw className="size-3"/>Sync to Coach
                </button>
              </div>
              <BoardView
                pieces={sandboxPieces} arrows={sandboxArrows} selected={sandboxSelected}
                flipped={sandboxFlipped} interactive lastMove={sandboxLastMove}
                onSquareClick={handleSandboxClick}
                onMouseDown={handleSandboxMouseDown}
                onMouseUp={handleSandboxMouseUp}
                theme={boardTheme}
                pendingPromotion={sandboxPendingPromotion ? { square: sandboxPendingPromotion.to, color: sandboxPendingPromotion.color } : null}
                onPromote={resolveSandboxPromotion}
                onCancelPromotion={()=>setSandboxPendingPromotion(null)}
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={()=>setSandboxFlipped(f=>!f)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <FlipHorizontal2 className="size-3.5"/>Flip
                </button>
                <BoardThemePicker current={boardTheme} open={showThemePicker} onToggle={()=>setShowThemePicker(v=>!v)}
                  onPick={key=>{changeBoardTheme(key);setShowThemePicker(false)}} />
                <button type="button" onClick={()=>{setSandboxArrows([]);setSandboxSelected(null)}}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <Trash2 className="size-3.5"/>Clear
                </button>
                <button type="button" onClick={submitAnswer}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors">
                  <CheckCircle2 className="size-3.5"/>Submit Answer
                </button>
              </div>
              <p className="text-[11px] text-zinc-400">Make your move then click Submit · Right-click drag to draw arrows</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Video + Challenge + Hands + Chat ── */}
        <div className="lg:col-span-2 space-y-3 flex flex-col">

          {/* Video */}
          {(jitsiUrl||zoomUrl)&&(
            <div className="space-y-2">
              <p className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Video className="size-3.5"/>Video Call</p>
              {jitsiUrl?(
                <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900">
                  <JitsiEmbed
                    roomName={jitsiUrl.split("meet.jit.si/")[1]?.split("#")[0] ?? `ChessConnect-${sessionId.replace(/-/g,"").substring(0,12)}`}
                    displayName={userName}
                    role={role}
                    height={300}
                    videoQuality={videoQuality}
                  />
                </div>
              ):(
                <a href={zoomUrl!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors">
                  <Video className="size-4"/>Join Zoom Call
                </a>
              )}
            </div>
          )}

          {/* Coach: post challenge panel */}
          {role==="coach"&&!readonly&&(
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <p className="text-[12px] font-bold text-amber-800 flex items-center gap-1.5"><Trophy className="size-3.5"/>Post Challenge</p>
              <textarea
                value={challengeText} onChange={e=>setChallengeText(e.target.value)}
                placeholder="e.g. Find the best move for White! (current position will be sent)"
                rows={2}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-[12px] placeholder:text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={challengeCorrect} onChange={e=>setChallengeCorrect(e.target.value)} placeholder="Correct move (e.g. Nf3)" className="h-8 rounded-lg border border-amber-300 bg-white px-2 text-[11px] placeholder:text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"/>
                <input type="text" value={challengeExplain} onChange={e=>setChallengeExplain(e.target.value)} placeholder="Solution explanation" className="h-8 rounded-lg border border-amber-300 bg-white px-2 text-[11px] placeholder:text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"/>
              </div>
              <button type="button" onClick={sendChallenge} disabled={!challengeText.trim()}
                className="w-full h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                <Zap className="size-3.5"/>Send Challenge to Students
              </button>
            </div>
          )}

          {/* Raise hands panel */}
          {role==="coach"&&raisedHands.length>0&&(
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
              <p className="text-[12px] font-bold text-blue-800 flex items-center gap-1.5">
                <Hand className="size-3.5"/>Raised Hands ({raisedHands.length})
              </p>
              {raisedHands.map(h=>(
                <div key={h.studentId} className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-blue-800">{h.studentName}</span>
                  <button type="button" onClick={()=>dismissHand(h.studentId)}
                    className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold">Dismiss</button>
                </div>
              ))}
            </div>
          )}

          {/* Student: raise hand */}
          {role==="student"&&!readonly&&(
            <button type="button" onClick={toggleHand}
              className={cn("flex items-center justify-center gap-2 h-11 rounded-xl border-2 text-[13px] font-semibold transition-colors",
                handRaised?"border-blue-400 bg-blue-50 text-blue-700":"border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              )}>
              <Hand className={cn("size-4",handRaised&&"animate-bounce")}/>
              {handRaised?"Hand Raised — Waiting for Coach":"Raise Hand"}
            </button>
          )}

          {/* Chat */}
          <div className="flex flex-col bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden" style={{minHeight:300}}>
            <div className="px-4 py-2.5 border-b border-zinc-200 flex items-center gap-2">
              <MessageSquare className="size-3.5 text-zinc-500"/>
              <p className="text-[12px] font-bold text-zinc-700">Class Chat</p>
              <span className="ml-auto text-[11px] text-zinc-400">{messages.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{maxHeight:260}}>
              {messages.length===0&&<p className="text-[12px] text-zinc-400 text-center py-6">No messages yet</p>}
              {messages.map(msg=>{
                const isMine=msg.senderName===userName
                return(
                  <div key={msg.id} className={cn("flex gap-2",isMine?"flex-row-reverse":"flex-row")}>
                    <div className={cn("size-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",msg.senderRole==="coach"?"bg-teal-100 text-teal-700":"bg-blue-100 text-blue-700")}>
                      {msg.senderName[0]?.toUpperCase()}
                    </div>
                    <div className={cn("max-w-[78%] flex flex-col gap-0.5",isMine?"items-end":"items-start")}>
                      <p className="text-[10px] text-zinc-400">{msg.senderName}</p>
                      <div className={cn("px-3 py-1.5 rounded-2xl text-[12px] leading-snug",isMine?"bg-teal-600 text-white rounded-tr-sm":"bg-white text-zinc-800 border border-zinc-200 rounded-tl-sm")}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef}/>
            </div>
            {!readonly&&(
              <div className="p-2.5 border-t border-zinc-200 flex gap-2">
                <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat()}}} placeholder={`Message as ${role}…`} className="flex-1 h-9 rounded-xl border border-zinc-200 bg-white px-3 text-[12px] placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-teal-400"/>
                <button type="button" onClick={sendChat} disabled={sending||!chatInput.trim()} className="size-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-colors disabled:opacity-40">
                  <Send className="size-3.5"/>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Coach: student answers ── */}
      {role==="coach"&&answers.length>0&&(
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] font-bold text-zinc-700 flex items-center gap-2">
              <Users className="size-3.5 text-blue-600"/>Student Answers ({answers.length})
            </p>
            {activeChallenge&&(activeChallenge.targetFen||activeChallenge.correctMoves.length>0)&&(
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  {answers.filter(a=>a.isCorrect===true).length} correct
                </span>
                <span className="px-2 py-1 rounded-full bg-red-100 text-red-600">
                  {answers.filter(a=>a.isCorrect===false).length} incorrect
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {answers.map(ans=>(
              <div key={ans.studentId} className={cn("flex items-center gap-3 p-3 rounded-xl border",ans.isCorrect===true?"border-emerald-200 bg-emerald-50":ans.isCorrect===false?"border-red-200 bg-red-50":"border-zinc-100 bg-zinc-50")}>
                <MiniBoard fen={ans.fen} size={80}/>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-[11px] font-bold text-zinc-800 truncate">{ans.studentName}</p>
                    {ans.isCorrect===true&&<CheckCircle2 className="size-3 text-emerald-500 shrink-0"/>}
                    {ans.isCorrect===false&&<X className="size-3 text-red-400 shrink-0"/>}
                  </div>
                  {ans.lastMove&&<p className="text-[10px] font-mono text-zinc-500">{ans.lastMove}</p>}
                  <p className="text-[10px] text-zinc-400">{new Date(ans.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</p>
                  <button type="button" onClick={()=>{loadFen(ans.fen);toast(`Loaded ${ans.studentName}'s answer`)}} className="mt-1 text-[10px] text-teal-600 hover:underline font-semibold">Load ↑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
