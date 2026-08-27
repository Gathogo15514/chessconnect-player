"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, GraduationCap, Grid2x2, Swords, TrendingUp, BookOpen, UserRound, Trophy } from "lucide-react"

const NAV = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/train",       label: "Train",       icon: GraduationCap },
  { href: "/puzzles",     label: "Puzzles",     icon: Grid2x2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/games",       label: "Games",       icon: Swords },
  { href: "/progress",    label: "Progress",    icon: TrendingUp },
  { href: "/lessons",     label: "Lessons",     icon: BookOpen },
  { href: "/coach",       label: "Coach",       icon: UserRound },
]

export function Sidebar({ coachName, nextSession }: { coachName?: string | null; nextSession?: string | null }) {
  const path = usePathname()

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col gap-6 bg-brand-green px-4 py-5">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-1.5 no-underline">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-brand-cream font-serif text-[13px] font-bold text-brand-green">
          CL
        </span>
        <span className="font-serif text-[15px] text-white">
          ChessLead <em className="not-italic text-brand-gold">Trainer</em>
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(item => {
          const active = path === item.href || path.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium no-underline transition-colors " +
                (active
                  ? "bg-brand-gold/15 text-brand-gold font-semibold"
                  : "text-white/55 hover:bg-white/5 hover:text-white/80")
              }
            >
              <Icon size={17} strokeWidth={1.8} className={active ? "opacity-100" : "opacity-85"} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {coachName && (
        <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Your coach</p>
          <div className="flex items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-gold font-serif text-xs font-bold text-brand-green">
              {coachName.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-white">{coachName}</p>
              {nextSession && <p className="mt-px text-[10.5px] text-white/50">Next: {nextSession}</p>}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
