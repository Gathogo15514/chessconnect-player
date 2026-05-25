"use client"

import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

const MAIN_API = process.env.NEXT_PUBLIC_MAIN_API_URL ?? ""

type Item = {
  id:           string
  name:         string
  description?: string | null
  item_type:    string
  gold_cost:    number
  icon_emoji?:  string | null
  rarity?:      string | null
  stock?:       number | null
}

type Purchase = { item_id: string; quantity: number; purchased_at: string }

type GoldTx = {
  amount:           number
  balance_after:    number
  transaction_type: string
  description?:     string | null
  created_at:       string
}

type GameProfile = {
  gold_balance:    number
  streak_shields:  number
  current_level:   number
}

const RARITY_COLOR: Record<string, string> = {
  common:    "border-stone-200",
  uncommon:  "border-emerald-300",
  rare:      "border-blue-400",
  epic:      "border-purple-400",
  legendary: "border-amber-400",
}

export default function GoldShopPage() {
  const router = useRouter()
  const [playerId,  setPlayerId]  = useState<string | null>(null)
  const [gp,        setGp]        = useState<GameProfile | null>(null)
  const [items,     setItems]     = useState<Item[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [txHistory, setTxHistory] = useState<GoldTx[]>([])
  const [loading,   setLoading]   = useState(true)
  const [buying,    setBuying]    = useState<string | null>(null)
  const [buyMsg,    setBuyMsg]    = useState<{id:string; msg:string; ok:boolean} | null>(null)
  const [tab,       setTab]       = useState<"shop"|"history">("shop")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pl } = await (supabase.from("players") as any)
        .select("id").eq("profile_id", session.user.id).maybeSingle()
      if (!pl) { setLoading(false); return }
      setPlayerId(pl.id)

      const [gpRes, itemsRes, purchRes, txRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles") as any)
          .select("gold_balance, streak_shields, current_level").eq("player_id", pl.id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("gami_marketplace_items") as any)
          .select("id, name, description, item_type, gold_cost, icon_emoji, rarity, stock")
          .eq("is_active", true).order("gold_cost"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("gami_purchases") as any)
          .select("item_id, quantity, purchased_at").eq("player_id", pl.id).is("used_at", null),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("gold_transactions") as any)
          .select("amount, balance_after, transaction_type, description, created_at")
          .eq("player_id", pl.id).order("created_at", { ascending: false }).limit(10),
      ])

      setGp(gpRes.data ?? null)
      setItems(itemsRes.data ?? [])
      setPurchases(purchRes.data ?? [])
      setTxHistory(txRes.data ?? [])
      setLoading(false)
    })
  }, [router])

  async function handleBuy(item: Item) {
    if (!playerId) return
    setBuying(item.id)
    setBuyMsg(null)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace("/login"); return }

    try {
      const res = await fetch(`${MAIN_API}/api/v1/player/shop/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ item_id: item.id }),
      })
      const d = await res.json()
      if (res.ok) {
        setBuyMsg({ id: item.id, msg: `Purchased! New balance: ${d.gold_balance ?? "?"} 🪙`, ok: true })
        setGp(prev => prev ? { ...prev, gold_balance: d.gold_balance ?? prev.gold_balance } : prev)
      } else {
        setBuyMsg({ id: item.id, msg: d.error ?? "Purchase failed", ok: false })
      }
    } catch {
      setBuyMsg({ id: item.id, msg: "Could not reach server", ok: false })
    } finally {
      setBuying(null)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const ownedIds = new Set(purchases.map(p => p.item_id))

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0f172a" }}>
      <header style={{ background: "linear-gradient(135deg, #0f172a, #1a0d2e)", borderBottom: "1px solid rgba(245,158,11,0.2)" }}
        className="text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚔️</span>
          <div>
            <p className="font-bold text-base" style={{ color: "#f59e0b" }}>The Armory</p>
            <p className="text-xs" style={{ color: "rgba(245,158,11,0.5)" }}>Gold Shop</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="text-sm hover:text-white" style={{ color: "rgba(245,158,11,0.5)" }}>Sign out</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#f59e0b", borderTopColor: "transparent" }} />
          </div>
        ) : (
          <>
            {/* Gold balance */}
            <div style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20 }}
              className="p-4 flex items-center gap-4">
              <span className="text-4xl">🪙</span>
              <div>
                <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>{(gp?.gold_balance ?? 0).toLocaleString()}</p>
                <p className="text-xs" style={{ color: "rgba(245,158,11,0.6)" }}>Gold balance</p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-bold text-white">{gp?.streak_shields ?? 0}</p>
                <p className="text-xs" style={{ color: "rgba(245,158,11,0.6)" }}>🛡 Shields</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl p-1" style={{ background: "rgba(255,255,255,0.05)" }}>
              {(["shop","history"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                  style={{
                    background: tab === t ? "rgba(245,158,11,0.15)" : "transparent",
                    color: tab === t ? "#f59e0b" : "rgba(255,255,255,0.35)",
                    border: tab === t ? "1px solid rgba(245,158,11,0.3)" : "1px solid transparent",
                  }}>
                  {t === "shop" ? "⚔️ Armory" : "📋 History"}
                </button>
              ))}
            </div>

            {/* Shop */}
            {tab === "shop" && (
              items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                  <span className="text-4xl">🛒</span>
                  <p className="mt-3 text-stone-600 font-medium">Shop is empty</p>
                  <p className="text-sm text-stone-400 mt-1">Items will appear here once they are added.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => {
                    const owned = ownedIds.has(item.id)
                    const canAfford = (gp?.gold_balance ?? 0) >= item.gold_cost
                    const msg = buyMsg?.id === item.id ? buyMsg : null
                    return (
                      <div key={item.id} className={`bg-white rounded-2xl border-2 p-4 shadow-sm ${RARITY_COLOR[item.rarity ?? "common"] ?? "border-stone-200"}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-3xl flex-shrink-0">{item.icon_emoji ?? "📦"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-stone-900 text-sm">{item.name}</p>
                              {item.rarity && item.rarity !== "common" && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{item.rarity}</span>
                              )}
                              {owned && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Owned</span>}
                            </div>
                            {item.description && <p className="text-xs text-stone-400 mt-0.5">{item.description}</p>}
                            {item.stock != null && <p className="text-xs text-amber-600 mt-0.5">{item.stock} left</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-amber-600">{item.gold_cost} 🪙</p>
                            <button
                              onClick={() => handleBuy(item)}
                              disabled={!canAfford || owned || buying === item.id}
                              className={`mt-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                                owned ? "bg-stone-100 text-stone-400 cursor-not-allowed" :
                                !canAfford ? "bg-stone-100 text-stone-400 cursor-not-allowed" :
                                "bg-amber-500 text-white hover:bg-amber-400"
                              }`}
                            >
                              {buying === item.id ? "…" : owned ? "Owned" : !canAfford ? "Need more 🪙" : "Buy"}
                            </button>
                          </div>
                        </div>
                        {msg && (
                          <p className={`text-xs font-medium mt-2 ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.msg}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* History */}
            {tab === "history" && (
              txHistory.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
                  <p className="text-stone-400 text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                  {txHistory.map((tx, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < txHistory.length - 1 ? "border-b border-stone-50" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">{tx.description ?? tx.transaction_type}</p>
                        <p className="text-xs text-stone-400">
                          {new Date(tx.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className={`text-sm font-bold ${tx.amount >= 0 ? "text-amber-600" : "text-red-500"}`}>
                          {tx.amount >= 0 ? "+" : ""}{tx.amount} 🪙
                        </p>
                        <p className="text-xs text-stone-400">bal: {tx.balance_after}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
