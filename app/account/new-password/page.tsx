"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span style={{ color: met ? "#1A6B42" : "#D1D5DB" }}>{met ? "✓" : "✕"}</span>
      <span style={{ color: met ? "#1A6B42" : "#9CA3AF" }}>{label}</span>
    </div>
  )
}

// Reached only via the "reset password" email link. /auth/callback exchanges
// the recovery code for a session before redirecting here, so the user is
// authenticated but — by definition of "forgot password" — doesn't know
// their old password, so this page sets a new one from that session alone.
export default function NewPasswordPage() {
  const [checking,   setChecking]   = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [newPw,      setNewPw]      = useState("")
  const [confirmPw,  setConfirmPw]  = useState("")
  const [saving,     setSaving]     = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthorized(!!data.user)
      setChecking(false)
    })
  }, [])

  const rules = {
    length:    newPw.length >= 8,
    uppercase: /[A-Z]/.test(newPw),
    lowercase: /[a-z]/.test(newPw),
    number:    /[0-9]/.test(newPw),
    match:     newPw.length > 0 && newPw === confirmPw,
  }
  const allRulesMet = Object.values(rules).every(Boolean)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!allRulesMet) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password: newPw })
    if (err) { setSaving(false); setError(err.message); return }

    // Recovery session is single-purpose — sign out so the user re-authenticates
    // with the new password rather than staying in this transient session.
    await supabase.auth.signOut()
    setSaving(false)
    setDone(true)
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
          {checking ? (
            <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>Verifying reset link…</p>
          ) : !authorized ? (
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#111827", marginBottom: 8 }}>Link expired</h1>
              <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>
                This password reset link is invalid or has expired.
              </p>
              <Link href="/reset-password" style={{ fontSize: 13, color: "#1A6B42", fontWeight: 600, textDecoration: "none" }}>Request new link →</Link>
            </div>
          ) : done ? (
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#111827", marginBottom: 8 }}>Password updated</h1>
              <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>
                Sign in with your new password.
              </p>
              <Link href="/login" style={{ fontSize: 13, color: "#1A6B42", fontWeight: 600, textDecoration: "none" }}>← Back to login</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.02em", color: "#111827", marginBottom: 4 }}>Set new password</h1>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Choose a new password for your account.</p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="cc-label">New password</label>
                  <input
                    className="cc-input"
                    type="password" required autoComplete="new-password"
                    value={newPw} onChange={e => setNewPw(e.target.value)}
                  />
                  {newPw.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, padding: 10, background: "#F7F3EC", borderRadius: 8 }}>
                      <PasswordRule met={rules.length}    label="At least 8 characters" />
                      <PasswordRule met={rules.uppercase} label="One uppercase letter" />
                      <PasswordRule met={rules.lowercase} label="One lowercase letter" />
                      <PasswordRule met={rules.number}    label="One number" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="cc-label">Confirm new password</label>
                  <input
                    className="cc-input"
                    type="password" required autoComplete="new-password"
                    value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  />
                  {confirmPw.length > 0 && <div style={{ marginTop: 6 }}><PasswordRule met={rules.match} label="Passwords match" /></div>}
                </div>

                {error && (
                  <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ color: "#DC2626", fontSize: 13 }}>{error}</p>
                  </div>
                )}

                <button type="submit" disabled={saving || !allRulesMet} className="cc-btn-primary">
                  {saving ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
