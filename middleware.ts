import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()      { return req.cookies.getAll() },
        setAll(list)  {
          list.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname

  if (!user && !path.startsWith("/login") && !path.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/assignments", req.url))
  }

  return res
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.json).*)"] }
