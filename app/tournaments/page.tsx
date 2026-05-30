"use client"
import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { fmtDate }             from "@/lib/dates"

type Tournament={id:string;title:string;event_type?:string|null;status:string;start_date:string;end_date?:string|null;venue_name?:string|null;entry_fee_kes?:number|null;is_fide_rated?:boolean|null;format?:string|null;participant_count?:number|null;max_participants?:number|null;counties?:{name:string}|null;tournament_types?:{label:string}|null}
type Registration={id:string;status:string;payment_status:string;seeding_number?:number|null;rating_at_reg?:number|null;created_at:string;tournaments:Tournament|null}
const RS:Record<string,{color:string;bg:string}>={confirmed:{color:"#16A34A",bg:"rgba(22,163,74,0.08)"},pending:{color:"#D97706",bg:"rgba(217,119,6,0.08)"},waitlisted:{color:"#2563EB",bg:"rgba(37,99,235,0.08)"},withdrawn:{color:"#9CA3AF",bg:"rgba(156,163,175,0.08)"},disqualified:{color:"#DC2626",bg:"rgba(220,38,38,0.08)"}}

export default function TournamentsPage() {
  const router=useRouter()
  const [regs,setRegs]=useState<Registration[]>([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState<"upcoming"|"past"|"withdrawn">("upcoming")

  useEffect(()=>{
    const supabase=createClient()
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(!session){router.replace("/login");return}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const{data:player}=await(supabase.from("players")as any).select("id").eq("profile_id",session.user.id).maybeSingle()
      if(!player){setLoading(false);return}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const{data}=await(supabase.from("tournament_registrations")as any).select(`id,status,payment_status,seeding_number,rating_at_reg,created_at,tournaments(id,title,event_type,status,start_date,end_date,venue_name,entry_fee_kes,is_fide_rated,format,participant_count,max_participants,counties(name),tournament_types(label))`).eq("player_id",player.id).order("created_at",{ascending:false})
      setRegs(data??[]);setLoading(false)
    })
  },[router])

  const today=new Date()
  const upcoming=regs.filter(r=>r.tournaments&&!["withdrawn","disqualified"].includes(r.status)&&(new Date(r.tournaments.start_date)>=today||r.tournaments.status==="in_progress"))
  const past=regs.filter(r=>r.tournaments&&!["withdrawn","disqualified"].includes(r.status)&&new Date(r.tournaments.start_date)<today&&r.tournaments.status!=="in_progress")
  const withdrawn=regs.filter(r=>["withdrawn","disqualified"].includes(r.status))
  const lists={upcoming,past,withdrawn}
  const visible=lists[tab]??[]

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",paddingBottom:72}}>
      <style>{`@keyframes cc-spin{to{transform:rotate(360deg)}} @keyframes cc-live{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <header style={{background:"#1B5E35",padding:"16px 18px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontFamily:"serif",fontSize:22,color:"#fff"}}>♚</span>
        <div>
          <h1 style={{fontFamily:"var(--font-display)",fontSize:22,color:"#fff",letterSpacing:"0.04em"}}>TOURNAMENTS</h1>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:1}}>{regs.length} registration{regs.length!==1?"s":""}</p>
        </div>
      </header>

      <main style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 0",display:"flex",flexDirection:"column",gap:12}}>
        {loading?(
          <div style={{display:"flex",justifyContent:"center",paddingTop:60}}>
            <div style={{width:32,height:32,border:"3px solid #1B5E35",borderTopColor:"transparent",borderRadius:"50%",animation:"cc-spin 0.8s linear infinite"}}/>
          </div>
        ):(
          <>
            {/* Tabs */}
            <div style={{display:"flex",background:"#fff",borderRadius:12,padding:4,border:"1px solid var(--border)",gap:2}}>
              {(["upcoming","past","withdrawn"]as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"8px 4px",borderRadius:9,border:"none",fontSize:12,fontWeight:tab===t?700:500,background:tab===t?"#1B5E35":"transparent",color:tab===t?"#fff":"var(--text-2)",cursor:"pointer",transition:"all 0.15s",letterSpacing:"0.01em"}}>
                  {t.charAt(0).toUpperCase()+t.slice(1)} <span style={{opacity:.7}}>({lists[t].length})</span>
                </button>
              ))}
            </div>

            {visible.length===0?(
              <div className="cc-card" style={{padding:40,textAlign:"center"}}>
                <p style={{fontSize:32}}>🏆</p>
                <p style={{fontWeight:600,color:"var(--text-2)",marginTop:10}}>{tab==="upcoming"?"No upcoming tournaments":tab==="past"?"No past tournaments":"No withdrawn registrations"}</p>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {visible.map(r=>{
                  const t=r.tournaments;if(!t)return null
                  const days=Math.ceil((new Date(t.start_date).getTime()-today.getTime())/86400000)
                  const isLive=t.status==="in_progress"
                  const rs=RS[r.status]??RS.pending
                  return(
                    <div key={r.id} className="cc-card" style={{overflow:"hidden"}}>
                      <div style={{padding:"13px 16px",borderBottom:"1px solid var(--border)"}}>
                        {isLive&&(
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:"#16A34A",animation:"cc-live 1.2s ease-in-out infinite",display:"inline-block"}}/>
                            <span style={{fontSize:11,fontWeight:700,color:"#16A34A",letterSpacing:"0.06em"}}>LIVE NOW</span>
                          </div>
                        )}
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontWeight:700,fontSize:15,color:"var(--text)"}}>{t.title}</p>
                            {t.tournament_types?.label&&<p style={{fontSize:12,color:"var(--text-3)",marginTop:2}}>{t.tournament_types.label}</p>}
                          </div>
                          <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:99,color:rs.color,background:rs.bg,border:`1px solid ${rs.color}25`,flexShrink:0,textTransform:"capitalize"}}>{r.status}</span>
                        </div>
                      </div>
                      <div style={{padding:"10px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px"}}>
                        <span style={{fontSize:12,color:"var(--text-2)"}}>📅 {fmtDate(t.start_date)}</span>
                        {t.venue_name&&<span style={{fontSize:12,color:"var(--text-2)"}}>📍 {t.venue_name}</span>}
                        {t.counties?.name&&<span style={{fontSize:12,color:"var(--text-2)"}}>🗺 {t.counties.name}</span>}
                        {t.format&&<span style={{fontSize:12,color:"var(--text-2)"}}>⏱ {t.format}</span>}
                        {t.entry_fee_kes!=null&&<span style={{fontSize:12,color:"var(--text-2)"}}>💰 KES {t.entry_fee_kes.toLocaleString()}</span>}
                        {t.is_fide_rated&&<span style={{fontSize:12,color:"var(--blue)",fontWeight:600}}>★ FIDE Rated</span>}
                        {r.seeding_number&&<span style={{fontSize:12,color:"var(--text-2)"}}>Seed #{r.seeding_number}</span>}
                      </div>
                      <div style={{padding:"8px 16px 12px",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,color:r.payment_status==="paid"?"#16A34A":"#D97706",background:r.payment_status==="paid"?"rgba(22,163,74,0.08)":"rgba(217,119,6,0.08)",border:`1px solid ${r.payment_status==="paid"?"rgba(22,163,74,0.2)":"rgba(217,119,6,0.2)"}`}}>
                          {r.payment_status==="paid"?"✓ Paid":r.payment_status}
                        </span>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {days>0&&days<=14&&<span style={{fontSize:12,color:"var(--gold)",fontWeight:500}}>{days===1?"Tomorrow":`In ${days} days`}</span>}
                          {t.participant_count!=null&&<span style={{fontSize:11,color:"var(--text-3)"}}>{t.participant_count}{t.max_participants?`/${t.max_participants}`:""} players</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav/>
    </div>
  )
}
