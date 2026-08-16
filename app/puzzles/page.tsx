"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Grid2x2, BookOpen, Swords, Crown, Target, Compass, DoorOpen, Calculator, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell } from "@/components/nav/AppShell"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

type Category = { id: string; name: string; slug: string; display_order: number }
type Topic = { id: string; category_id: string; name: string; slug: string; display_order: number }

const CATEGORY_ICON: Record<string, LucideIcon> = {
  fundamentals: BookOpen,
  tactics: Swords,
  "checkmate-patterns": Crown,
  endgames: Target,
  strategy: Compass,
  openings: DoorOpen,
  middlegame: Swords,
  calculation: Calculator,
}

export default function PuzzlesPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({}) // topic slug -> published puzzle count
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cats } = await (supabase.from("chess_categories") as any)
        .select("id, name, slug, display_order, parent:parent_id(slug)")
        .neq("slug", "chess").neq("slug", "legacy-import")
        .order("display_order")
      const topLevel = (cats ?? []).filter((c: { parent?: { slug: string } | null }) => c.parent?.slug === "chess")
      setCategories(topLevel)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tps } = await (supabase.from("chess_topics") as any)
        .select("id, category_id, name, slug, display_order")
        .in("category_id", topLevel.map((c: Category) => c.id))
        .order("display_order")
      setTopics(tps ?? [])

      // Only rows whose parent puzzle actually passes RLS (published +
      // visible) come through this join — draft/imported content stays
      // invisible here by design, same gate a real player hits.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tagged } = await (supabase.from("puzzle_themes") as any)
        .select("theme_id, puzzles!inner(id), chess_themes!inner(slug)")
      const byThemeSlug: Record<string, number> = {}
      for (const row of tagged ?? []) {
        const slug = row.chess_themes?.slug as string | undefined
        if (!slug) continue
        byThemeSlug[slug] = (byThemeSlug[slug] ?? 0) + 1
      }
      // theme slugs are `${topicSlug}-theme` by convention
      const byTopicSlug: Record<string, number> = {}
      for (const [themeSlug, n] of Object.entries(byThemeSlug)) {
        byTopicSlug[themeSlug.replace(/-theme$/, "")] = n
      }
      setCounts(byTopicSlug)

      setLoading(false)
    })
  }, [router])

  return (
    <AppShell>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground">Tactical training</p>
        <h1 className="font-serif text-xl font-bold text-foreground md:text-2xl">Puzzles</h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Grid2x2}
          title="Puzzle training is coming soon"
          detail="Daily puzzles, puzzle rating, streaks, and tactical-theme breakdowns will live here."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {categories.map(cat => {
            const catTopics = topics.filter(t => t.category_id === cat.id)
            if (catTopics.length === 0) return null
            const Icon = CATEGORY_ICON[cat.slug] ?? Grid2x2
            return (
              <div key={cat.id}>
                <div className="mb-2 flex items-center gap-1.5">
                  <Icon size={15} className="text-muted-foreground" />
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">{cat.name}</h2>
                </div>
                <Card className="divide-y divide-border p-0">
                  {catTopics.map(topic => {
                    const count = counts[topic.slug] ?? 0
                    return (
                      <Link
                        key={topic.id}
                        href={`/puzzles/${topic.slug}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 no-underline transition-colors hover:bg-secondary/50"
                      >
                        <span className="text-[14px] font-medium text-foreground">{topic.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className={count > 0 ? "text-[12px] font-semibold text-primary" : "text-[12px] text-muted-foreground/60"}>
                            {count > 0 ? `${count} puzzle${count === 1 ? "" : "s"}` : "Coming soon"}
                          </span>
                          <ChevronRight size={15} className="text-muted-foreground/40" />
                        </span>
                      </Link>
                    )
                  })}
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
