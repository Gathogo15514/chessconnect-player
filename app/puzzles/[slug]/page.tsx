"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Puzzle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

type Topic = { id: string; name: string; slug: string; description: string | null }
type Level = { id: string; name: string; slug: string; rank: number }
type TopicLevel = { id: string; level: Level }

const LEVEL_STYLE: Record<string, string> = {
  beginner: "bg-primary/10 text-primary",
  elementary: "bg-info/10 text-info",
  intermediate: "bg-amber-500/10 text-amber-700",
  advanced: "bg-[#5B57C7]/10 text-[#5B57C7]",
  expert: "bg-destructive/10 text-destructive",
  master: "bg-foreground/10 text-foreground",
}

export default function TopicPuzzlesPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [levels, setLevels] = useState<TopicLevel[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({}) // level slug -> published puzzle count
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: t } = await (supabase.from("chess_topics") as any)
        .select("id, name, slug, description")
        .eq("slug", params.slug).maybeSingle()
      if (!t) { setNotFound(true); setLoading(false); return }
      setTopic(t)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tls } = await (supabase.from("topic_levels") as any)
        .select("id, level:level_id(id, name, slug, rank)")
        .eq("topic_id", t.id)
      const sorted = (tls ?? []).sort((a: TopicLevel, b: TopicLevel) => a.level.rank - b.level.rank)
      setLevels(sorted)

      // Published puzzles tagged with this topic's theme, broken down by
      // difficulty. RLS gates this the same way it gates every player —
      // draft/imported content simply doesn't come through.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tagged } = await (supabase.from("puzzle_themes") as any)
        .select("puzzles!inner(difficulty), chess_themes!inner(slug)")
        .eq("chess_themes.slug", `${params.slug}-theme`)
      const byDifficulty: Record<string, number> = {}
      for (const row of tagged ?? []) {
        const d = row.puzzles?.difficulty as string | undefined
        if (!d) continue
        byDifficulty[d] = (byDifficulty[d] ?? 0) + 1
      }
      setCounts(byDifficulty)

      setLoading(false)
    })
  }, [router, params.slug])

  return (
    <AppShell>
      <Link href="/puzzles" className="mb-3 flex items-center gap-1 text-[13px] text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft size={14} /> All topics
      </Link>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : notFound || !topic ? (
        <EmptyState icon={Puzzle} title="Topic not found" detail="This puzzle topic doesn't exist." />
      ) : (
        <>
          <div className="mb-5">
            <p className="text-xs text-muted-foreground">Puzzle topic</p>
            <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">{topic.name}</h1>
            {topic.description && <p className="mt-1 text-[13px] text-muted-foreground">{topic.description}</p>}
          </div>

          {levels.length === 0 ? (
            <EmptyState icon={Puzzle} title="No levels set up yet" detail="This topic hasn't been broken into levels yet." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {levels.map(tl => {
                const count = counts[tl.level.slug] ?? 0
                return (
                  <Card key={tl.id} className="flex-row items-center justify-between p-4">
                    <div className="flex items-center gap-2.5">
                      <span className={"rounded-full px-2.5 py-1 text-[12px] font-semibold " + (LEVEL_STYLE[tl.level.slug] ?? "bg-secondary text-muted-foreground")}>
                        {tl.level.name}
                      </span>
                    </div>
                    <span className={count > 0 ? "text-[13px] font-semibold text-primary" : "text-[13px] text-muted-foreground/60"}>
                      {count > 0 ? `${count} puzzle${count === 1 ? "" : "s"} ready` : "Coming soon"}
                    </span>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
