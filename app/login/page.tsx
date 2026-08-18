"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const ERROR_MESSAGES: Record<string, string> = {
  wrong_portal: "That account isn't a player account — please use the main ChessLead login instead.",
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect")
  const errorParam = searchParams.get("error")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(errorParam ? (ERROR_MESSAGES[errorParam] ?? null) : null)

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    router.refresh()
    router.push(redirect && redirect.startsWith("/") ? redirect : "/dashboard")
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F3EC" }}>
      <style>{`
        @keyframes cc-spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #9CA3AF; }
        input:focus { border-color: #1A6B42 !important; box-shadow: 0 0 0 3px rgba(27,94,53,0.1) !important; outline: none; }
      `}</style>

      {/* ── Mobile layout: stacked ──────────────── */}
      {/* ── Desktop: side-by-side ──────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", minHeight: "100vh" }}>

        {/* Left panel — forest green brand side */}
        <div style={{
          display: "none",
          flex: "0 0 44%",
          background: "#1A6B42",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 44px",
          position: "relative",
          overflow: "hidden",
        }} className="login-left-panel">
          {/* Checkerboard texture */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.06,
            backgroundImage: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)",
            backgroundSize: "32px 32px",
          }} />

          {/* Logo */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/icons/icon-192.svg" alt="" width={32} height={32} style={{ borderRadius: 8 }} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#fff", letterSpacing: "0.04em" }}>
                ChessLead <em style={{ fontStyle: "normal", color: "#C9922E" }}>Trainer</em>
              </span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6 }}>
              Player Training Portal
            </p>
          </div>

          {/* Hero text */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: 48, lineHeight: 1.05,
              color: "#fff", letterSpacing: "0.03em",
              marginBottom: 16,
            }}>
              TRAIN.<br />IMPROVE.<br />DOMINATE.
            </p>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
              Your personal chess training portal. Access your sessions, missions, and progress — all in one place.
            </p>
          </div>

          {/* Bottom piece row */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12, opacity: 0.25 }}>
            {["♜","♞","♝","♛","♚","♝","♞","♜"].map((p, i) => (
              <span key={i} style={{ fontFamily: "serif", fontSize: 22, color: "#fff" }}>{p}</span>
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
          minHeight: "100vh",
        }}>
          {/* Mobile logo */}
          <div style={{ marginBottom: 36, textAlign: "center" }} className="login-mobile-logo">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              <img src="/icons/icon-192.svg" alt="" width={30} height={30} style={{ borderRadius: 7 }} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#111827", letterSpacing: "0.04em" }}>
                ChessLead <em style={{ fontStyle: "normal", color: "#C9922E" }}>Trainer</em>
              </span>
            </div>
            <p style={{ color: "#6B7280", fontSize: 13 }}>Player Training Portal</p>
          </div>

          {/* Form card */}
          <div style={{
            width: "100%",
            maxWidth: 380,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 20,
            padding: "32px 28px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: 28, letterSpacing: "0.04em",
              color: "#111827", marginBottom: 4,
            }}>
              SIGN IN
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>
              Welcome back. Enter your credentials to continue.
            </p>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="cc-label">Email address</label>
                <input
                  className="cc-input"
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label className="cc-label">Password</label>
                  <Link href="/reset-password" style={{ fontSize: 12, color: "#1A6B42", fontWeight: 600, textDecoration: "none" }}>
                    Forgot password?
                  </Link>
                </div>
                <input
                  className="cc-input"
                  type="password" required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div style={{
                  background: "rgba(220,38,38,0.06)",
                  border: "1px solid rgba(220,38,38,0.18)",
                  borderRadius: 10, padding: "10px 14px",
                }}>
                  <p style={{ color: "#DC2626", fontSize: 13 }}>{error}</p>
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="cc-btn-primary"
                style={{ marginTop: 4 }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "cc-spin 0.8s linear infinite" }} />
                    Signing in…
                  </span>
                ) : "Sign in"}
              </button>
            </form>
          </div>

          <p style={{ marginTop: 20, fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>
            Need access? Ask your coach for an invite.
          </p>
        </div>
      </div>

      {/* Responsive: show left panel on md+ */}
      <style>{`
        @media (min-width: 768px) {
          .login-left-panel  { display: flex !important; }
          .login-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F7F3EC" }} />}>
      <LoginForm />
    </Suspense>
  )
}
