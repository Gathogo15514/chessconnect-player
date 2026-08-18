"use client"

export type BufferedAttempt = {
  puzzle_id:     string
  item_id?:      string | null
  status:        "PASSED" | "FAILED" | "SKIPPED"
  attempts:      number
  seconds_taken: number
  moves_played:  string[]
  buffered_at:   number
}

const DB_NAME    = "cc-player-offline"
const STORE_NAME = "puzzle_attempts"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME))
        req.result.createObjectStore(STORE_NAME, { keyPath: "puzzle_id" })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function bufferAttempt(a: BufferedAttempt): Promise<void> {
  try {
    const db  = await openDB()
    const tx  = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(a)
    return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  } catch { /* no IndexedDB in SSR */ }
}

export async function flushBuffer(): Promise<BufferedAttempt[]> {
  try {
    const db    = await openDB()
    const tx    = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const records = await new Promise<BufferedAttempt[]>((res, rej) => {
      const req = store.getAll()
      req.onsuccess = () => res(req.result as BufferedAttempt[])
      req.onerror   = () => rej(req.error)
    })
    store.clear()
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
    return records
  } catch { return [] }
}

const MAIN_API = process.env.NEXT_PUBLIC_MAIN_API_URL ?? ""

export async function submitBuffered(
  assignmentId: string,
  playerId:     string,
  durationSecs: number,
  accessToken:  string,
): Promise<{ ok: boolean; processed: number }> {
  const records = await flushBuffer()
  if (!records.length) return { ok: true, processed: 0 }

  const passed = records.filter(r => r.status === "PASSED").length
  const failed = records.filter(r => r.status === "FAILED").length

  try {
    const res = await fetch(`${MAIN_API}/api/v1/submissions`, {
      method:  "POST",
      // app.chesslead.org and chesslead.org are separate origins with no
      // shared cookies, so identity has to travel as a Bearer token — the
      // player_id field below is kept for shape compatibility only, the
      // server resolves the real identity from this token.
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        assignment_id: assignmentId,
        player_id:     playerId,
        device_telemetry: {
          user_agent:   navigator.userAgent,
          network_type: (navigator as { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "unknown",
        },
        metrics: { total_duration_seconds: durationSecs, completed_count: passed, failed_count: failed },
        results: records.map(r => ({
          puzzle_id: r.puzzle_id, item_id: r.item_id ?? null,
          status: r.status, attempts: r.attempts,
          seconds_taken: r.seconds_taken, moves_played: r.moves_played,
        })),
      }),
    })
    return { ok: res.ok, processed: records.length }
  } catch {
    for (const r of records) await bufferAttempt(r)
    return { ok: false, processed: 0 }
  }
}

let _retryTimer: ReturnType<typeof setInterval> | null = null

export function startRetryLoop(
  assignmentId: string,
  playerId:     string,
  durationSecs: number,
  accessToken:  string,
  onSuccess?:   (processed: number) => void,
): void {
  if (_retryTimer !== null) return
  _retryTimer = setInterval(async () => {
    const has = await flushBuffer()
    if (!has.length) { stopRetryLoop(); return }
    for (const r of has) await bufferAttempt(r)
    const result = await submitBuffered(assignmentId, playerId, durationSecs, accessToken)
    if (result.ok) { stopRetryLoop(); onSuccess?.(result.processed) }
  }, 30_000)
}

export function stopRetryLoop(): void {
  if (_retryTimer !== null) { clearInterval(_retryTimer); _retryTimer = null }
}
