"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Clock } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import ClassroomLive from "@/components/classroom/ClassroomLive"
import { fmtDate, fmtTime } from "@/lib/dates"

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const JOINABLE_TYPES = ["classroom", "workshop", "online_analysis", "online"]

type SessionRow = {
  id: string; title: string; status: string; session_type: string
  session_date: string; start_time: string; end_time: string
}
type ClassroomRow = {
  delivery_mode: string; join_link: string | null
  board_fen: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  board_arrows: any[]
  video_quality: "performance" | "balanced" | "data_saver"
}

export default function ClassroomJoinPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [notFoundOrDenied, setNotFoundOrDenied] = useState(false)
  const [session, setSession] = useState<SessionRow | null>(null)
  const [classroom, setClassroom] = useState<ClassroomRow | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState("Student")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      if (!authSession) { router.replace(`/login?redirect=/classroom/${id}`); return }
      setUserId(authSession.user.id)

      const [sR, pR] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("sessions") as any)
          .select("id, title, status, session_type, session_date, start_time, end_time")
          .eq("id", id).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("profiles") as any).select("full_name").eq("id", authSession.user.id).maybeSingle(),
      ])

      if (!sR.data || !JOINABLE_TYPES.includes(sR.data.session_type)) {
        setNotFoundOrDenied(true)
        setLoading(false)
        return
      }
      setSession(sR.data)
      setUserName(pR.data?.full_name ?? authSession.user.email?.split("@")[0] ?? "Student")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cR } = await (supabase.from("classroom_sessions") as any)
        .select("delivery_mode, join_link, board_fen, board_arrows, video_quality")
        .eq("session_id", id).maybeSingle()
      setClassroom(cR ?? null)
      setLoading(false)
    })
  }, [id, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  if (notFoundOrDenied || !session || !userId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-serif text-xl font-bold text-foreground">Classroom not found</p>
        <p className="max-w-sm text-[13px] text-muted-foreground">This session either doesn&apos;t exist, isn&apos;t an online session, or you don&apos;t have access to it.</p>
        <Link href="/lessons" className="mt-2 text-[13px] font-semibold text-primary no-underline">Back to lessons</Link>
      </div>
    )
  }

  const isDone = session.status === "completed"
  const defaultMode = session.session_type === "online" ? "jitsi" : "interactive_board"
  const deliveryMode = classroom?.delivery_mode ?? defaultMode
  const joinLink = classroom?.join_link ?? null
  const videoQuality = classroom?.video_quality ?? "performance"
  const initialFen = classroom?.board_fen ?? STARTING_FEN
  const initialArrows = classroom?.board_arrows ?? []

  return (
    <div className="min-h-screen bg-secondary">
      <div className="sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-card px-4 py-2.5">
        <Link href="/dashboard" className="shrink-0 font-serif text-[16px] font-bold text-brand-green no-underline">
          ChessLead
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-foreground">{session.title}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            <span>{fmtDate(session.session_date)}</span>
            <span>{fmtTime(session.start_time)} – {fmtTime(session.end_time)}</span>
            <span className="capitalize">· {deliveryMode.replace(/_/g, " ")}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-full bg-info/10 px-2.5 py-1 text-[11px] font-bold text-info">Student</span>
          {isDone ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Session ended</span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Live
            </span>
          )}
          <span className="hidden text-[12px] text-muted-foreground sm:block">{userName}</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4">
        <ClassroomLive
          sessionId={id}
          deliveryMode={deliveryMode}
          joinLink={joinLink}
          videoQuality={videoQuality}
          initialFen={initialFen}
          initialArrows={initialArrows}
          role="student"
          userName={userName}
          userId={userId}
          readonly={isDone}
        />
      </div>
    </div>
  )
}
