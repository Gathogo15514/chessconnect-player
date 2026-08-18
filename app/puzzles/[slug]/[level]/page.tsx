"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Lightbulb, Trophy, CheckCircle2, XCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ChessBoard } from "@/components/chess/ChessBoard"
import { useBoardSettings } from "@/components/chess/BoardSettingsProvider"
import { useActivity, type Activity } from "@/lib/chess/activity"
import { cn } from "@/lib/utils"

type PuzzleRow = { id: string; fen: string; solution: string[]; rating: number | null; difficulty: string }

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner", elementary: "Elementary", intermediate: "Intermediate",
  advanced: "Advanced", expert: "Expert", master: "Master",
}

export default function PuzzleSolvePage() {
  const router = useRouter()
  const params = useParams<{ slug: string; level: string }>()
  const { settings } = useBoardSettings()

  const [topicName, setTopicName] = useState<string>("")
  const [puzzles, setPuzzles] = useState<PuzzleRow[]>([])
  const [idx, setIdx] = useState(0)
  const [solvedCount, setSolvedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace(`/login?redirect=/puzzles/${params.slug}/${params.level}`); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: topic } = await (supabase.from("chess_topics") as any)
        .select("id, name, slug").eq("slug", params.slug).maybeSingle()
      if (!topic) { setNotFound(true); setLoading(false); return }
      setTopicName(topic.name)

      // Same theme-join pattern used by /puzzles/[slug] to count puzzles per
      // level — here we pull the actual rows instead of just a count.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tagged } = await (supabase.from("puzzle_themes") as any)
        .select("puzzles!inner(id, fen, solution, rating, difficulty, status, visibility), chess_themes!inner(slug)")
        .eq("chess_themes.slug", `${params.slug}-theme`)

      const taggedRows = (tagged ?? []) as { puzzles: PuzzleRow | null }[]
      const rows: PuzzleRow[] = taggedRows
        .map(r => r.puzzles)
        .filter((p): p is PuzzleRow => p !== null && p.difficulty === params.level)
        .map(p => ({ id: p.id, fen: p.fen, solution: p.solution, rating: p.rating, difficulty: p.difficulty }))

      setPuzzles(rows)
      setLoading(false)
    })
  }, [params.slug, params.level, router])

  const puzzle = puzzles[idx]

  const activityValue: Activity = puzzle
    ? { id: puzzle.id, type: "puzzle", fen: puzzle.fen, solutionMoves: puzzle.solution, difficulty: puzzle.difficulty, theme: params.slug }
    : { id: "empty", type: "practice", fen: "8/8/8/8/8/8/8/8 w - - 0 1" }

  const activity = useActivity(activityValue)

  const handleMove = useCallback((from: string, to: string, promotion?: Parameters<typeof activity.attemptMove>[2]) => {
    const outcome = activity.attemptMove(from, to, promotion)
    if (outcome === "complete") setSolvedCount(c => c + 1)
  }, [activity])

  function goNext() {
    setIdx(i => Math.min(i + 1, puzzles.length - 1))
  }

  const isLastPuzzle = idx >= puzzles.length - 1
  const allDone = puzzles.length > 0 && idx >= puzzles.length - 1 && activity.feedback === "complete"

  return (
    <AppShell>
      <Link href={`/puzzles/${params.slug}`} className="mb-3 flex items-center gap-1 text-[13px] text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft size={14} /> {topicName || "Back"}
      </Link>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : notFound ? (
        <EmptyState icon={Trophy} title="Topic not found" detail="This puzzle topic doesn't exist." />
      ) : puzzles.length === 0 ? (
        <EmptyState icon={Trophy} title="No puzzles here yet" detail={`No ${LEVEL_LABEL[params.level] ?? params.level} puzzles are published for ${topicName} yet — check back soon.`} />
      ) : (
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{topicName} · {LEVEL_LABEL[params.level] ?? params.level}</p>
              <h1 className="font-serif text-lg font-bold text-foreground">Puzzle {idx + 1} of {puzzles.length}</h1>
            </div>
            {puzzle?.rating && <span className="rounded-full bg-secondary px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">Rating {puzzle.rating}</span>}
          </div>

          <ChessBoard
            fen={activity.fen}
            onMove={handleMove}
            getLegalTargets={sq => activity.busy ? [] : activity.engine.legalTargets(sq)}
            getNeedsPromotion={(from, to) => activity.needsPromotion(from, to)}
            lastMove={activity.lastMove}
            checkedSquare={activity.engine.checkedKingSquare}
            movableColor={activity.engine.turn}
            interactive={activity.feedback !== "complete"}
            flipped={settings.boardFlipped}
            settings={settings}
          />

          {activity.feedback === "wrong" && (
            <Card className={cn("flex items-center gap-3 p-3.5", "border-destructive/20 bg-destructive/5")}>
              <XCircle size={18} className="shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-destructive">Not quite — try again</p>
                {activity.wrongAttempts >= 3 && <p className="text-[12px] text-destructive/70">Stuck? Reveal the solution below.</p>}
              </div>
              {activity.wrongAttempts >= 3 && (
                <button onClick={activity.reveal} className="shrink-0 rounded-lg border border-destructive/30 px-3 py-1.5 text-[12px] font-semibold text-destructive">
                  Reveal
                </button>
              )}
            </Card>
          )}

          {activity.feedback === "correct" && (
            <Card className="flex items-center gap-3 border-primary/20 bg-primary/5 p-3.5">
              <CheckCircle2 size={18} className="shrink-0 text-primary" />
              <p className="text-[13px] font-bold text-primary">Good move! Keep going…</p>
            </Card>
          )}

          {activity.feedback === "complete" && (
            <Card className="flex flex-col items-center gap-2 border-primary/20 bg-primary/5 p-5 text-center">
              <Trophy size={24} className="text-primary" />
              <p className="font-serif text-base font-bold text-foreground">
                {allDone ? "All puzzles solved!" : "Puzzle solved!"}
              </p>
              <p className="text-[12px] text-muted-foreground">{solvedCount} of {puzzles.length} solved this session</p>
              {!isLastPuzzle ? (
                <button onClick={goNext} className="mt-1 rounded-lg bg-brand-green px-5 py-2 text-[13px] font-bold text-white">
                  Next puzzle →
                </button>
              ) : (
                <Link href={`/puzzles/${params.slug}`} className="mt-1 rounded-lg bg-brand-green px-5 py-2 text-[13px] font-bold text-white no-underline">
                  Back to levels
                </Link>
              )}
            </Card>
          )}

          {activity.feedback === "none" && !activity.busy && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3.5 py-2.5">
              <Lightbulb size={14} className="shrink-0 text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">
                {activity.engine.turn === "w" ? "White" : "Black"} to move — find the best move.
              </p>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
