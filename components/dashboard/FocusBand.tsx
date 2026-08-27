import { Trophy } from "lucide-react"

export function FocusBand({
  rating,
  ratingDelta,
  peakRating,
  ratingClass,
  focusHeadline,
  focusDetail,
  focusHref,
  leaderboardRank,
}: {
  rating: number | null
  ratingDelta: number | null
  peakRating: number | null
  ratingClass?: string | null
  focusHeadline: string
  focusDetail: string
  focusHref: string
  /** This month's leaderboard position among the player's coach's other
   * students, or null if not ranked yet (no completed exercises this month). */
  leaderboardRank: number | null
}) {
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-green to-brand-green-mid p-6 md:p-7">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8">
        <div>
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/50">Current rating</p>
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-[44px] font-bold leading-none tracking-tight text-white tabular-nums md:text-[52px]">
              {rating ?? "—"}
            </span>
            {ratingDelta !== null && (
              <span className={"text-[13px] font-bold " + (ratingDelta >= 0 ? "text-[#8CE0AE]" : "text-[#F0A79A]")}>
                {ratingDelta >= 0 ? "▲" : "▼"} {Math.abs(ratingDelta)}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11.5px] text-white/50">
            {peakRating ? `Peak ${peakRating}` : "No rating history yet"}{ratingClass ? ` · ${ratingClass}` : ""}
          </p>
        </div>

        <div className="hidden self-stretch w-px bg-white/10 md:block" />

        <div>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/50">Today&apos;s focus</p>
          <p className="mb-1 max-w-[34ch] text-[16px] font-semibold text-white md:text-[16.5px]">{focusHeadline}</p>
          <p className="mb-3.5 text-[12.5px] text-white/55">{focusDetail}</p>
          <a
            href={focusHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-green no-underline"
          >
            Resume training →
          </a>
        </div>

        <div className="hidden self-stretch w-px bg-white/10 md:block" />

        <a href="/leaderboard" className="flex items-center gap-3 no-underline md:flex-col md:items-end md:text-right">
          <Trophy size={22} className="text-brand-gold" fill="currentColor" fillOpacity={0.25} />
          <div>
            <span className="font-serif text-2xl font-bold leading-none text-white tabular-nums">
              {leaderboardRank ? `#${leaderboardRank}` : "—"}
            </span>
            <p className="mt-0.5 text-[10.5px] text-white/50">this month</p>
          </div>
        </a>
      </div>
    </div>
  )
}
