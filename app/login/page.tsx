"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }

    // router.refresh() tells Next.js to re-fetch all server data with the new session
    // before navigating — this ensures cookies are readable server-side
    router.refresh()
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">♟</span>
          <h1 className="mt-3 text-2xl font-bold text-stone-900">ChessConnect</h1>
          <p className="text-sm text-stone-500 mt-1">Player Portal</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
              placeholder="student@school.ac.ke"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input
              type="password" required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-green-800 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-stone-400 mt-6">
          Need an account? Ask your coach to invite you.
        </p>
      </div>
    </div>
  )
}
