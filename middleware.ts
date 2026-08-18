import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const sanitize = (s: string | undefined) => (s ?? "").replace(/[^\x20-\x7E]/g, "").trim()

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll()     { return req.cookies.getAll() },
        setAll(list) {
          list.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const path = req.nextUrl.pathname

  const publicPaths = ["/login", "/auth", "/reset-password"]
  const isPublicPath = publicPaths.some(p => path === p || path.startsWith(p + "/"))

  // Deep links: an unauthenticated visit to e.g. /puzzles is sent to login
  // with the original path preserved, so login returns them there instead
  // of the generic dashboard.
  if (!session && !isPublicPath) {
    const url = new URL("/login", req.url)
    if (path !== "/") url.searchParams.set("redirect", path)
    return NextResponse.redirect(url)
  }

  if (session) {
    if (path === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // M-2: Block non-player roles from accessing this portal entirely.
    // Coaches, admins etc. who somehow have a player profile must not get
    // student-portal access under their privileged identity. Send them to
    // the actual management platform rather than just erroring here — the
    // URL alone must never be trusted as a role signal in either direction.
    if (!isPublicPath) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role_name")
        .eq("id", session.user.id)
        .single()

      if (profile && profile.role_name !== "player") {
        const mainUrl = process.env.NEXT_PUBLIC_MAIN_API_URL ?? "https://chesslead.org"
        return NextResponse.redirect(`${mainUrl}/dashboard?error=wrong_portal`)
      }
    }
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icons|sw\\.js|manifest\\.json).*)"],
}
