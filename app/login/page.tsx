"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const PIECES = ["♔","♕","♖","♗","♘","♙","♚","♛","♜","♝","♞","♟"]

type FloatingPiece = { id: number; piece: string; x: number; size: number; duration: number; delay: number; opacity: number }

function useFloatingPieces(count = 14): FloatingPiece[] {
  const [pieces, setPieces] = useState<FloatingPiece[]>([])
  useEffect(() => {
    setPieces(
      Array.from({ length: count }, (_, i) => ({
        id:       i,
        piece:    PIECES[i % PIECES.length],
        x:        Math.random() * 100,
        size:     18 + Math.random() * 28,
        duration: 12 + Math.random() * 16,
        delay:    -Math.random() * 20,
        opacity:  0.04 + Math.random() * 0.1,
      }))
    )
  }, [count])
  return pieces
}

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [entered,  setEntered]  = useState(false)
  const floats = useFloatingPieces(14)

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    setEntered(true)
    setTimeout(() => {
      router.refresh()
      router.push("/dashboard")
    }, 700)
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #0d2b14 50%, #1a0d2e 100%)" }}>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(110vh) rotate(0deg); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
        }
        @keyframes portalPulse {
          0%,100% { box-shadow: 0 0 40px #10b98133, 0 0 80px #10b98111, inset 0 0 40px #10b98108; }
          50%      { box-shadow: 0 0 60px #10b98155, 0 0 120px #10b98122, inset 0 0 60px #10b98115; }
        }
        @keyframes gateOpen {
          0%   { clip-path: inset(0 50% 0 50%); opacity: 0.3; }
          100% { clip-path: inset(0 0% 0 0%); opacity: 1; }
        }
        @keyframes runeGlow {
          0%,100% { opacity:0.3; text-shadow: 0 0 8px #10b981; }
          50%      { opacity:0.9; text-shadow: 0 0 20px #10b981, 0 0 40px #10b981; }
        }
        .float-piece { position:absolute; bottom:-10vh; animation: floatUp linear infinite; pointer-events:none; }
        .portal-ring { animation: portalPulse 3s ease-in-out infinite; }
        .rune        { animation: runeGlow 2.5s ease-in-out infinite; display:inline-block; }
        .gate-open   { animation: gateOpen 0.7s ease-out forwards; }
      `}</style>

      {/* Floating pieces background */}
      {floats.map(p => (
        <span
          key={p.id}
          className="float-piece"
          style={{
            left: `${p.x}%`,
            fontSize: p.size,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
            color: "#10b981",
          }}
        >
          {p.piece}
        </span>
      ))}

      {/* Portal ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="portal-ring" style={{
          width: 480, height: 480, borderRadius: "50%",
          border: "1px solid rgba(16,185,129,0.2)",
        }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{
          width: 360, height: 360, borderRadius: "50%",
          border: "1px solid rgba(16,185,129,0.12)",
        }} />
      </div>

      {/* Card */}
      <div className={`relative z-10 w-full max-w-sm ${entered ? "gate-open" : ""}`}>
        {/* Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center gap-3 mb-4">
            {["♜","♞","♛","♚","♞","♜"].map((p, i) => (
              <span key={i} className="rune" style={{
                color: "#10b981", fontSize: 20,
                animationDelay: `${i * 0.4}s`,
              }}>{p}</span>
            ))}
          </div>
          <h1 style={{
            fontFamily: "Georgia, serif",
            fontSize: 28, fontWeight: 800,
            background: "linear-gradient(135deg, #10b981, #f59e0b, #10b981)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            letterSpacing: "0.02em",
          }}>
            ChessConnect
          </h1>
          <p style={{ color: "rgba(16,185,129,0.6)", fontSize: 13, marginTop: 6, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Enter the Arena
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background: "rgba(13,27,20,0.85)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 20,
          padding: "28px 24px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(16,185,129,0.1)",
        }}>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(16,185,129,0.7)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                Email
              </label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="warrior@chess.ke"
                style={{
                  width: "100%", marginTop: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 10, padding: "10px 14px",
                  color: "#e2e8f0", fontSize: 14,
                  outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(16,185,129,0.6)")}
                onBlur={e => (e.target.style.borderColor = "rgba(16,185,129,0.2)")}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(16,185,129,0.7)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                Password
              </label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", marginTop: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: 10, padding: "10px 14px",
                  color: "#e2e8f0", fontSize: 14,
                  outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(16,185,129,0.6)")}
                onBlur={e => (e.target.style.borderColor = "rgba(16,185,129,0.2)")}
              />
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>
              </div>
            )}

            <button
              type="submit" disabled={loading || entered}
              style={{
                width: "100%", marginTop: 4,
                padding: "12px",
                background: loading || entered
                  ? "rgba(16,185,129,0.3)"
                  : "linear-gradient(135deg, #059669, #10b981)",
                border: "none", borderRadius: 12,
                color: "#fff", fontSize: 15, fontWeight: 700,
                cursor: loading || entered ? "not-allowed" : "pointer",
                letterSpacing: "0.04em",
                boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                transition: "all 0.2s",
              }}
            >
              {entered ? "⚔️ Entering…" : loading ? "Verifying…" : "⚔️ Enter Arena"}
            </button>
          </form>
        </div>

        <p style={{ textAlign:"center", fontSize:12, color:"rgba(16,185,129,0.3)", marginTop:20 }}>
          Need access? Ask your coach for an invite.
        </p>
      </div>
    </div>
  )
}
