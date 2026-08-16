import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon
  title: string
  detail: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <Icon size={30} className="text-muted-foreground/50" />
      <p className="font-serif text-lg font-bold text-foreground">{title}</p>
      <p className="max-w-[38ch] text-[13px] text-muted-foreground">{detail}</p>
    </div>
  )
}
