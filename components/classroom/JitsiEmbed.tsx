"use client"

import { useEffect, useRef } from "react"

interface Props {
  roomName:    string
  displayName: string
  role:        "coach" | "student"
  height?:     number
  videoQuality?: "performance" | "balanced" | "data_saver"
}

const RESOLUTION_BY_QUALITY: Record<string, number> = {
  performance: 720,
  balanced:    480,
  data_saver:  180,
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JitsiMeetExternalAPI: any
  }
}

export default function JitsiEmbed({ roomName, displayName, role, height = 320, videoQuality = "performance" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null)

  useEffect(() => {
    let script: HTMLScriptElement | null = null

    function initJitsi() {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return
      if (apiRef.current) { apiRef.current.dispose(); apiRef.current = null }

      apiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", {
        roomName,
        parentNode: containerRef.current,
        height,
        configOverwrite: {
          // `interface_config.js` (and the old top-level/interfaceConfigOverwrite
          // `toolbarButtons`/`TOOLBAR_BUTTONS` placements) has been deprecated —
          // Jitsi migrated toolbar-button configuration into config.js, so as of
          // current meet.jit.si this has to be `toolbarButtons` (lowercase)
          // inside `configOverwrite`. Previously tried as a top-level
          // constructor option per an (incorrect, now-outdated) assumption —
          // verified live that placement rendered only the built-in minimal
          // toolbar regardless of the button list given. This is the
          // currently-documented location; "desktop" is the screen-share
          // button id.
          toolbarButtons: [
            "camera", "microphone", "desktop", "hangup",
            "chat", "tileview", "fullscreen",
            "raisehand", "settings",
            ...(role === "coach" ? ["mute-everyone", "kick"] : []),
          ],
          // `prejoinPageEnabled` is also deprecated in favor of
          // `prejoinConfig.enabled` — the old key being silently ignored is
          // why the prejoin lobby screen never actually got skipped before.
          prejoinConfig:            { enabled: false },
          enableLobbyChat:          false,
          lobby:                    { enabled: false },  // no waiting room
          disableDeepLinking:       true,
          startWithAudioMuted:      true,
          startWithVideoMuted:      false,
          enableClosePage:          false,
          disableInviteFunctions:   true,
          resolution: RESOLUTION_BY_QUALITY[videoQuality],
          constraints: {
            video: {
              height: { ideal: RESOLUTION_BY_QUALITY[videoQuality], max: RESOLUTION_BY_QUALITY[videoQuality] },
            },
          },
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO:            false,
          SHOW_JITSI_WATERMARK:        false,
          SHOW_WATERMARK_FOR_GUESTS:   false,
          SHOW_BRAND_WATERMARK:        false,
          DEFAULT_REMOTE_DISPLAY_NAME: "Student",
        },
        userInfo: { displayName },
      })
    }

    if (window.JitsiMeetExternalAPI) {
      // Script already loaded (e.g. hot reload)
      initJitsi()
    } else {
      script = document.createElement("script")
      script.src = "https://meet.jit.si/external_api.js"
      script.async = true
      script.onload = initJitsi
      document.head.appendChild(script)
    }

    return () => {
      apiRef.current?.dispose()
      apiRef.current = null
      if (script && document.head.contains(script)) document.head.removeChild(script)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName])

  return <div ref={containerRef} style={{ width: "100%", minHeight: height }} />
}
