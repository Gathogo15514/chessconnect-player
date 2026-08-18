"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const [email,     setEmail]     = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError(null)
    const supabase = createClient()
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin

    // /auth/callback exchanges the recovery code for a session before landing
    // on the page that sets a new password — the resetPasswordForEmail
    // redirectTo isn't that exchange itself.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent("/account/new-password")}`,
    })

    setLoading(false)
    if (err) setError(err.message)
    else setSubmitted(true)
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F3EC", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          <img src="/icons/icon-192.svg" alt="" width={30} height={30} style={{ borderRadius: 7 }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#111827", letterSpacing: "0.04em" }}>
            ChessLead <em style={{ fontStyle: "normal", color: "#C9922E" }}>Trainer</em>
          </span>
        </div>

        <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 20, padding: "32px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#111827", marginBottom: 8 }}>Check your inbox</h1>
              <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>
                If <strong>{email}</strong> is registered, you&apos;ll receive a password reset link shortly.
              </p>
              <Link href="/login" style={{ fontSize: 13, color: "#1A6B42", fontWeight: 600, textDecoration: "none" }}>← Back to login</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.02em", color: "#111827", marginBottom: 4 }}>Reset password</h1>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>We&apos;ll email you a reset link.</p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="cc-label">Email address</label>
                  <input
                    className="cc-input"
                    type="email" required autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ color: "#DC2626", fontSize: 13 }}>{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="cc-btn-primary">
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p style={{ marginTop: 20, textAlign: "center" }}>
                <Link href="/login" style={{ fontSize: 13, color: "#9CA3AF", textDecoration: "none" }}>← Back to login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
