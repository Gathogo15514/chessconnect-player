"use client"

import { useEffect, useState } from "react"
import { createClient }        from "@/lib/supabase/client"

export default function AuthExchangePage() {
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [msg,    setMsg]    = useState("")

  useEffect(() => {
    const hash = window.location.hash.slice(1) // strip leading #
    const params = new URLSearchParams(hash)
    const access_token  = params.get("access_token")
    const refresh_token = params.get("refresh_token")

    // Clear the fragment immediately so tokens aren't exposed in browser history
    history.replaceState(null, "", window.location.pathname + window.location.search)

    if (!access_token || !refresh_token) {
      // Reading the URL hash is inherently client-only, so this validation
      // can only run inside an effect — there's no async gap to wait out
      // before reporting "the link was bad."
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMsg("Invalid or missing session tokens. Please log in.")
      setStatus("error")
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        setMsg("Session could not be established. Please log in again.")
        setStatus("error")
      } else {
        window.location.replace("/dashboard")
      }
    })
  }, [])

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="text-center max-w-xs">
          <span className="text-4xl">⚠️</span>
          <p className="mt-3 text-stone-700 font-medium">{msg}</p>
          <a href="/login" className="mt-4 inline-block text-sm text-green-800 underline font-semibold">
            Go to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-green-800 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-stone-500">Setting up your session…</p>
      </div>
    </div>
  )
}
