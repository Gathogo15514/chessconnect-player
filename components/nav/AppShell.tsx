import { Sidebar } from "@/components/nav/Sidebar"
import { BottomNav } from "@/components/nav/BottomNav"

export function AppShell({
  children,
  coachName,
  nextSession,
}: {
  children: React.ReactNode
  coachName?: string | null
  nextSession?: string | null
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar coachName={coachName} nextSession={nextSession} />
      <main className="flex-1 px-4 pt-5 pb-24 md:px-8 md:pt-7 md:pb-8">
        <div className="mx-auto max-w-[900px]">{children}</div>
      </main>
      <BottomNav />
    </div>
  )
}
