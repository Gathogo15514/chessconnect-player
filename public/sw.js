const CACHE = "cc-player-v4"

const PRECACHE = ["/", "/login"]

const NETWORK_ONLY = [
  "/api/v1/player/",
  "/api/v1/submissions",
  "/auth/",
]

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", e => {
  const { request } = e
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // Skip non-http(s) schemes (chrome-extension, etc.)
  if (!url.protocol.startsWith("http")) return

  // Always network-only for API and auth
  if (NETWORK_ONLY.some(p => url.pathname.startsWith(p))) return

  // Cache-first for static assets
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    e.respondWith(
      caches.match(request).then(cached => cached ?? fetch(request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(request, clone))
        return res
      }))
    )
    return
  }

  // Network-first for pages, fall back to cache then offline shell
  e.respondWith(
    fetch(request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(request, clone))
        return res
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached ?? caches.match("/offline").then(off => off ?? Response.error())
        )
      )
  )
})
