"use client"
import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

const LEVELS: Record<number,{title:string;emoji:string}> = {
  1:{title:"Pawn",emoji:"♟"},4:{title:"Knight",emoji:"♞"},7:{title:"Bishop",emoji:"♝"},
  10:{title:"Rook",emoji:"♜"},15:{title:"Queen Initiate",emoji:"♛"},20:{title:"Queen",emoji:"♛"},
  25:{title:"King's Guard",emoji:"♚"},30:{title:"Grand Tactician",emoji:"🏅"},
  40:{title:"Chess Champion",emoji:"🏆"},50:{title:"Grandmaster",emoji:"♔"},
}
function getTitle(l:number){const k=Object.keys(LEVELS).map(Number).sort((a,b)=>b-a).find(k=>l>=k);return k!=null?LEVELS[k]:{title:"Pawn",emoji:"♟"}}
function xpPct(t:number,s:number,th:number){const r=th-s,p=t-s;if(r<=0)return 100;return Math.min(100,Math.round((p/r)*100))}
type GP={current_level:number;total_xp:number;gold_balance:number;streak_current:number;streak_shields:number;level_xp_start:number;level_xp_threshold:number}
type QA={id:string;status:string;expires_at:string|null;quest_campaigns?:{title:string;cover_emoji?:string|null;description?:string|null}|null}
type XP={event_type:string;xp_awarded:number;created_at:string;notes?:string|null}
const XP_LABELS:Record<string,string>={quest_complete:"Quest Complete",quest_perfect:"Perfect Clear",boss_defeated:"Boss Defeated",session_attended:"Session Attended",streak_bonus:"Streak Bonus",tournament_played:"Tournament Played",tournament_win:"Tournament Win",coach_award:"Coach Award",rating_milestone:"Rating Milestone"}

export default function ProgressPage() {
  const router=useRouter()
  const [gp,setGp]=useState<GP|null>(null)
  const [quests,setQuests]=useState<QA[]>([])
  const [xpLog,setXpLog]=useState<XP[]>([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    const supabase=createClient()
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(!session){router.replace("/login");return}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const{data:player}=await(supabase.from("players")as any).select("id").eq("profile_id",session.user.id).maybeSingle()
      if(!player){setLoading(false);return}
      const[gpR,qR,xR]=await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_game_profiles")as any).select("current_level,total_xp,gold_balance,streak_current,streak_shields,level_xp_start,level_xp_threshold").eq("player_id",player.id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("quest_assignments")as any).select("id,status,expires_at,quest_campaigns(id,title,cover_emoji,description)").eq("player_id",player.id).eq("status","active").limit(6),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("player_xp_events")as any).select("event_type,xp_awarded,created_at,notes").eq("player_id",player.id).order("created_at",{ascending:false}).limit(12),
      ])
      setGp(gpR.data??null);setQuests(qR.data??[]);setXpLog(xR.data??[]);setLoading(false)
    })
  },[router])

  const lv=gp?.current_level??1,totalXp=gp?.total_xp??0,pct=gp?xpPct(totalXp,gp.level_xp_start,gp.level_xp_threshold):0,lt=getTitle(lv)

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",paddingBottom:72}}>
      <style>{`@keyframes cc-spin{to{transform:rotate(360deg)}} @keyframes cc-shimmer{0%{background-position:-400% center}100%{background-position:400% center}}`}</style>
      <header style={{background:"#1B5E35",padding:"16px 18px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontFamily:"serif",fontSize:22,color:"#fff"}}>♛</span>
        <div>
          <h1 style={{fontFamily:"var(--font-display)",fontSize:22,color:"#fff",letterSpacing:"0.04em"}}>XP &amp; LEVEL</h1>
          {gp&&<p style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:1}}>{totalXp.toLocaleString()} total XP · Level {lv}</p>}
        </div>
      </header>

      <main style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 0",display:"flex",flexDirection:"column",gap:12}}>
        {loading?(
          <div style={{display:"flex",justifyContent:"center",paddingTop:60}}>
            <div style={{width:32,height:32,border:"3px solid #1B5E35",borderTopColor:"transparent",borderRadius:"50%",animation:"cc-spin 0.8s linear infinite"}}/>
          </div>
        ):!gp?(
          <div className="cc-card" style={{padding:40,textAlign:"center"}}>
            <p style={{fontSize:32}}>♛</p>
            <p style={{fontWeight:600,color:"var(--text-2)",marginTop:10}}>No progress yet</p>
            <p style={{fontSize:13,color:"var(--text-3)",marginTop:6}}>Complete missions and attend sessions to earn XP.</p>
          </div>
        ):(
          <>
            {/* Level card */}
            <div className="cc-card" style={{overflow:"hidden"}}>
              <div style={{background:"#1B5E35",padding:"20px 18px",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:60,height:60,borderRadius:14,background:"rgba(255,255,255,0.15)",border:"2px solid rgba(255,255,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"serif",fontSize:28,color:"#fff",flexShrink:0}}>
                  {lt.emoji}
                </div>
                <div style={{flex:1}}>
                  <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>{lt.title}</p>
                  <p style={{fontFamily:"var(--font-display)",fontSize:30,color:"#fff",letterSpacing:"0.03em",lineHeight:1}}>LEVEL {lv}</p>
                </div>
              </div>
              <div style={{padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                  <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Progress to Level {lv+1}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--green)"}}>{pct}%</span>
                </div>
                <div style={{height:8,background:"#E5E7EB",borderRadius:99,overflow:"hidden"}}>
                  <div style={{width:`${Math.max(2,pct)}%`,height:"100%",borderRadius:99,background:"linear-gradient(90deg,#1B5E35,#2E7D50,#1B5E35)",backgroundSize:"400% auto",animation:"cc-shimmer 3s linear infinite"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                  <span style={{fontSize:11,color:"var(--text-3)"}}>{(gp.level_xp_start).toLocaleString()} XP</span>
                  <span style={{fontSize:11,color:"var(--text-3)"}}>{(gp.level_xp_threshold).toLocaleString()} XP</span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{label:"Gold",value:gp.gold_balance.toLocaleString(),icon:"🪙"},{label:"Streak",value:`${gp.streak_current}d`,icon:"🔥"},{label:"Shields",value:String(gp.streak_shields),icon:"🛡"}].map(s=>(
                <div key={s.label} className="cc-card" style={{padding:"14px 10px",textAlign:"center"}}>
                  <span style={{fontSize:22}}>{s.icon}</span>
                  <p style={{fontFamily:"var(--font-display)",fontSize:22,color:"var(--text)",marginTop:5,lineHeight:1}}>{s.value}</p>
                  <p style={{fontSize:11,color:"var(--text-3)",marginTop:4,fontWeight:500}}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Active quests */}
            {quests.length>0&&(
              <div className="cc-card" style={{overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
                  <p style={{fontWeight:600,fontSize:14,color:"var(--text)"}}>Active Quests</p>
                </div>
                {quests.map((q,i)=>{const c=q.quest_campaigns;return(
                  <div key={q.id} style={{padding:"11px 16px",borderBottom:i<quests.length-1?"1px solid var(--border)":"none",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:22,flexShrink:0}}>{c?.cover_emoji??"⚔"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c?.title??"Quest"}</p>
                      {q.expires_at&&<p style={{fontSize:11,color:"var(--gold)",marginTop:1}}>Expires {new Date(q.expires_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</p>}
                    </div>
                    <span className="cc-badge cc-badge-green">Active</span>
                  </div>
                )})}
              </div>
            )}

            {/* XP history */}
            {xpLog.length>0&&(
              <div className="cc-card" style={{overflow:"hidden"}}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
                  <p style={{fontWeight:600,fontSize:14,color:"var(--text)"}}>XP History</p>
                </div>
                {xpLog.map((e,i)=>(
                  <div key={i} style={{padding:"10px 16px",borderBottom:i<xpLog.length-1?"1px solid var(--border)":"none",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                    <div style={{minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>{XP_LABELS[e.event_type]??e.event_type}</p>
                      {e.notes&&<p style={{fontSize:11,color:"var(--text-3)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.notes}</p>}
                      <p style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>{new Date(e.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</p>
                    </div>
                    <span style={{fontWeight:700,fontSize:14,color:"var(--green)",flexShrink:0}}>+{e.xp_awarded} XP</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav/>
    </div>
  )
}
