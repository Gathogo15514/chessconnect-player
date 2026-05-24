import { createServerClient } from "@supabase/ssr"
import { cookies }            from "next/headers"

const sanitize = (s: string | undefined) => (s ?? "").replace(/[^\x20-\x7E]/g, "").trim()

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll()          { return cookieStore.getAll() },
        setAll(list) {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* server component — middleware refreshes session */ }
        },
      },
    }
  )
}
