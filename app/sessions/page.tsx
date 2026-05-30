"use client"
import { useEffect, useState } from "react"
import { useRouter }           from "next/navigation"
import { createClient }        from "@/lib/supabase/client"
import { BottomNav }           from "@/components/BottomNav"
import { fmtDate, fmtWeekday } from "@/lib/dates"

type AR={status:string;method?:string|null;marked_at:string;sessions?:{id:string;title:string;session_date:string;start_time?:string|null;topic?:string|null;coaches?:{profiles?:{full_name?:string|null}|null}|null}|null}
const ST:Record<string,{color:string;label:string;bg:string}>={
  present:{color:"#16A34A",label:"Present",bg:"rgba(22,163,74,0.08)"},
  late:   {color:"#D97706",label:"Late",   bg:"rgba(217,119,6,0.08)"},
  excused:{color:"#2563EB",label:"Excused",bg:"rgba(37,99,235,0.08)"},
  absent: {color:"#DC2626",label:"Absent", bg:"rgba(220,38,38,0.08)"},
}

export default function SessionsPage() {
  const router=useRouter()
  const [attendance,setAttendance]=useState<AR[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{
    const supabase=createClient()
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(!session){router.replace("/login");return}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const{data:player}=await(supabase.from("players")as any).select("id").eq("profile_id",session.user.id).maybeSingle()
      if(!player){setLoading(false);return}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const{data,error:err}=await(supabase.from("attendance")as any).select("status,method,marked_at,sessions(id,title,session_date,start_time,topic,coaches(profiles(full_name)))").eq("player_id",player.id).order("marked_at",{ascending:false})
      if(err){setError(err.message)}else{setAttendance(data??[])}
      setLoading(false)
    })
  },[router])

  const total=attendance.length,present=attendance.filter(a=>a.status==="present").length,late=attendance.filter(a=>a.status==="late").length,pct=total>0?Math.round(((present+late)/total)*100):null

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",paddingBottom:72}}>
      <style>{`@keyframes cc-spin{to{transform:rotate(360deg)}}`}</style>
      <header style={{background:"#1B5E35",padding:"16px 18px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontFamily:"serif",fontSize:22,color:"#fff"}}>♜</span>
        <div>
          <h1 style={{fontFamily:"var(--font-display)",fontSize:22,color:"#fff",letterSpacing:"0.04em"}}>SESSIONS</h1>
          {pct!==null&&<p style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:1}}>{pct}% attendance · {total} sessions</p>}
        </div>
      </header>

      <main style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 0",display:"flex",flexDirection:"column",gap:12}}>
        {loading?(
          <div style={{display:"flex",justifyContent:"center",paddingTop:60}}>
            <div style={{width:32,height:32,border:"3px solid #1B5E35",borderTopColor:"transparent",borderRadius:"50%",animation:"cc-spin 0.8s linear infinite"}}/>
          </div>
        ):error?(
          <div style={{background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.16)",borderRadius:12,padding:20,textAlign:"center"}}>
            <p style={{color:"var(--red)",fontWeight:600}}>Could not load sessions</p>
            <p style={{fontSize:13,color:"var(--red)",opacity:.7,marginTop:4}}>{error}</p>
          </div>
        ):(
          <>
            {/* Summary card */}
            {pct!==null&&(
              <div className="cc-card" style={{padding:"16px 18px",display:"flex",alignItems:"center",gap:16}}>
                <div style={{position:"relative",width:64,height:64,flexShrink:0}}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#E5E7EB" strokeWidth="7"/>
                    <circle cx="32" cy="32" r="26" fill="none"
                      stroke={pct>=80?"#16A34A":pct>=60?"#D97706":"#DC2626"}
                      strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${pct*1.634} 163.4`}
                      transform="rotate(-90 32 32)"
                    />
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontWeight:800,fontSize:15,color:"var(--text)"}}>{pct}%</span>
                  </div>
                </div>
                <div style={{flex:1}}>
                  <p style={{fontWeight:700,fontSize:18,color:"var(--text)"}}>{present+late} <span style={{fontSize:13,color:"var(--text-3)",fontWeight:400}}>/ {total} attended</span></p>
                  <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                    {(["present","late","excused","absent"]as const).map(s=>{const count=attendance.filter(a=>a.status===s).length;if(!count)return null;const st=ST[s];return(
                      <span key={s} style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,color:st.color,background:st.bg,border:`1px solid ${st.color}25`}}>{count} {st.label}</span>
                    )})}
                  </div>
                </div>
              </div>
            )}

            {/* List */}
            {attendance.length===0?(
              <div className="cc-card" style={{padding:40,textAlign:"center"}}>
                <p style={{fontSize:28}}>📅</p>
                <p style={{fontWeight:600,color:"var(--text-2)",marginTop:10}}>No sessions yet</p>
                <p style={{fontSize:13,color:"var(--text-3)",marginTop:6}}>Your attendance will appear here once your coach marks sessions.</p>
              </div>
            ):(
              <div className="cc-card" style={{overflow:"hidden"}}>
                {attendance.map((a,i)=>{const st=ST[a.status]??ST.absent;return(
                  <div key={i} style={{padding:"12px 16px",borderBottom:i<attendance.length-1?"1px solid var(--border)":"none",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:9,flexShrink:0,background:st.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,color:st.color}}>
                      {a.status==="present"?"✓":a.status==="late"?"⏰":a.status==="excused"?"○":"✗"}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.sessions?.title??"Session"}</p>
                      <p style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>
                        {a.sessions?.session_date?`${fmtWeekday(a.sessions.session_date)}, ${fmtDate(a.sessions.session_date)}`:"—"}
                        {a.sessions?.start_time?` · ${a.sessions.start_time.slice(0,5)}`:""}
                        {a.sessions?.coaches?.profiles?.full_name?` · ${a.sessions.coaches.profiles.full_name}`:""}
                      </p>
                    </div>
                    <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,color:st.color,background:st.bg,border:`1px solid ${st.color}25`,flexShrink:0}}>{st.label}</span>
                  </div>
                )})}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav/>
    </div>
  )
}
