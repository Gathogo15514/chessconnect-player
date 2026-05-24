import { createBrowserClient } from "@supabase/ssr"

// Strip any non-printable / non-ASCII characters that can silently appear in
// env vars when values are copy-pasted (BOM U+FEFF, zero-width spaces, etc.).
// These invisible chars end up in Supabase's "apikey" fetch header and trigger
// the browser's "String contains non ISO-8859-1 code point" error.
function sanitize(s: string | undefined): string {
  return (s ?? "").replace(/[^\x20-\x7E]/g, "").trim()
}

export function createClient() {
  return createBrowserClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  )
}
