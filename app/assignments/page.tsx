"use client"
import { useEffect, useState } from "react"
import Link                    from "next/link"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"

const MAIN_API=process.env.NEXT_PUBLIC_MAIN_API_URL??""
type Assignment={result_id:string;assignment_id:string;player_status:string;title:string;description?:string|null;difficulty?:string|null;due_date?:string|null;estimated_minutes?:number|null;total_exercises:number;topic?:{title:string;icon:string}|null}
const DIFF:Record<string,{color:string;bg:string;label:string}>={
  beginner:    {color:"#16A34A",bg:"rgba(22,163,74,0.08)",   label:"Beginner"},
  intermediate:{color:"#D97706",bg:"rgba(217,119,6,0.08)",   label:"Intermediate"},
  advanced:    {color:"#7C3AED",bg:"rgba(124,58,237,0.08)",  label:"Advanced"},
}

export default function MissionsPage() {
  const router=useRouter()
  const [missions,setMissions]=useState<Assignment[]>([])
  const [loading,setLoading]=useState(true)
  const [apiError,setApiError]=useState<string|null>(null)

  useEffect(()=>{
    const supabase=createClient()
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(!session){router.replace("/login");return}
      try{
        const res=await fetch(`${MAIN_API}/api/v1/player/assignments/active`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"})
        if(res.status===401){router.replace("/login");return}
        if(!res.ok){const b=await res.json().catch(()=>({}));setApiError(b.error??`Error ${res.status}`);return}
        const data=await res.json();setMissions(data.assignments??[])
      }catch{setApiError("Could not reach the server.")}finally{setLoading(false)}
    })
  },[router])

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",paddingBottom:72}}>
      <style>{`@keyframes cc-spin{to{transform:rotate(360deg)}}`}</style>
      <header style={{background:"#1B5E35",padding:"16px 18px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"serif",fontSize:22,color:"#fff"}}>♞</span>
          <div>
            <h1 style={{fontFamily:"var(--font-display)",fontSize:22,color:"#fff",letterSpacing:"0.04em"}}>MISSIONS</h1>
            {!loading&&!apiError&&missions.length>0&&<p style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:1}}>{missions.length} active mission{missions.length!==1?"s":""}</p>}
          </div>
        </div>
      </header>

      <main style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 0",display:"flex",flexDirection:"column",gap:10}}>
        {loading?(
          <div style={{display:"flex",justifyContent:"center",paddingTop:60}}>
            <div style={{width:32,height:32,border:"3px solid #1B5E35",borderTopColor:"transparent",borderRadius:"50%",animation:"cc-spin 0.8s linear infinite"}}/>
          </div>
        ):apiError?(
          <div style={{background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.16)",borderRadius:12,padding:24,textAlign:"center"}}>
            <p style={{fontWeight:600,color:"var(--red)"}}>Could not load missions</p>
            <p style={{fontSize:13,color:"var(--red)",opacity:.7,marginTop:4}}>{apiError}</p>
            <button onClick={()=>window.location.reload()} style={{marginTop:12,padding:"8px 20px",borderRadius:10,border:"1px solid rgba(220,38,38,0.2)",background:"transparent",color:"var(--red)",fontSize:13,cursor:"pointer"}}>Retry</button>
          </div>
        ):missions.length===0?(
          <div className="cc-card" style={{padding:40,textAlign:"center"}}>
            <p style={{fontSize:32}}>🎯</p>
            <p style={{fontWeight:700,fontSize:16,color:"var(--text-2)",marginTop:10}}>No missions yet</p>
            <p style={{fontSize:13,color:"var(--text-3)",marginTop:6}}>Your coach will assign missions here.</p>
          </div>
        ):(
          missions.map((m,idx)=>{
            const diff=DIFF[m.difficulty??""]??null
            const inProg=m.player_status==="in_progress"
            const today=new Date()
            const due=m.due_date?new Date(m.due_date):null
            const daysLeft=due?Math.ceil((due.getTime()-today.getTime())/86400000):null
            const overdue=daysLeft!==null&&daysLeft<0
            return(
              <Link key={m.result_id} href={`/assignments/${m.assignment_id}`} style={{textDecoration:"none"}} >
                <div className="cc-card cc-card-press" style={{overflow:"hidden",borderLeft:`3px solid ${diff?.color??"#E5E7EB"}`,animationDelay:`${idx*0.04}s`}}>
                  <div style={{padding:"13px 16px"}}>
                    {/* Header row */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                        {m.topic&&<span style={{fontSize:11,color:"var(--text-3)",background:"var(--surface-2)",border:"1px solid var(--border)",borderRadius:6,padding:"1px 6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.topic.icon} {m.topic.title}</span>}
                        {overdue&&<span style={{fontSize:10,fontWeight:700,color:"var(--red)"}}>OVERDUE</span>}
                      </div>
                      <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:99,color:inProg?"#2563EB":"var(--text-3)",background:inProg?"rgba(37,99,235,0.08)":"var(--surface-2)",border:`1px solid ${inProg?"rgba(37,99,235,0.2)":"var(--border)"}`,flexShrink:0}}>
                        {inProg?"In Progress":"Start →"}
                      </span>
                    </div>
                    {/* Title */}
                    <p style={{fontWeight:700,fontSize:15,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</p>
                    {m.description&&<p style={{fontSize:12,color:"var(--text-3)",marginTop:3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{m.description}</p>}
                    {/* Meta */}
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:8}}>
                      {diff&&<span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,color:diff.color,background:diff.bg}}>{diff.label}</span>}
                      <span style={{fontSize:11,color:"var(--text-3)"}}>{m.total_exercises} exercises</span>
                      {m.estimated_minutes&&<span style={{fontSize:11,color:"var(--text-3)"}}>~{m.estimated_minutes}m</span>}
                      {daysLeft!==null&&!overdue&&<span style={{fontSize:11,color:daysLeft<=2?"var(--gold)":"var(--text-3)",fontWeight:daysLeft<=2?600:400}}>Due {daysLeft===0?"today":daysLeft===1?"tomorrow":`in ${daysLeft}d`}</span>}
                      {overdue&&due&&<span style={{fontSize:11,color:"var(--red)"}}>Was due {due.toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </main>
      <BottomNav/>
    </div>
  )
}
