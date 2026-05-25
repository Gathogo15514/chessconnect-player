// Consistent date formatting using Intl.DateTimeFormat with explicit locale
// Avoids SSR/client hydration mismatches from implicit toLocaleDateString

export function fmtDate(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d)
}

export function fmtDateShort(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d)
}

export function fmtTime(time: string | null | undefined): string {
  if (!time) return "—"
  // Handles "HH:MM:SS" or "HH:MM"
  return time.slice(0, 5)
}

export function fmtDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d)
}

export function fmtWeekday(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d)
}

export function fmtRelative(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d   = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  const now = Date.now()
  const ms  = now - d.getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60)           return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60)           return `${min}m ago`
  const hr  = Math.floor(min / 60)
  if (hr < 24)            return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7)           return `${days}d ago`
  return fmtDateShort(d)
}
