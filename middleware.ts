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

  if (!session && !path.startsWith("/login") && !path.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (session) {
    if (path === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // M-2: Block non-player roles from accessing this portal entirely.
    // Coaches, admins etc. who somehow have a player profile must not get
    // student-portal access under their privileged identity.
    if (!path.startsWith("/login") && !path.startsWith("/auth")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role_name")
        .eq("id", session.user.id)
        .single()

      if (profile && profile.role_name !== "player") {
        const url = new URL("/login", req.url)
        url.searchParams.set("error", "wrong_portal")
        return NextResponse.redirect(url)
      }
    }
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icons|sw\\.js|manifest\\.json).*)"],
}
