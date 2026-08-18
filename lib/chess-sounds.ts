import type { ThemeId } from "@/components/chess/themes"

// Frequencies and wave types per theme (Web Audio API — no file downloads needed)
type SoundDef = { freq: number; freq2?: number; type: OscillatorType; duration: number; ramp?: number }

const THEME_SOUNDS: Record<ThemeId, { move: SoundDef; capture: SoundDef; solve: SoundDef }> = {
  classic: {
    move:    { freq: 440, type: "sine",     duration: 0.12, ramp: 220 },
    capture: { freq: 330, type: "triangle", duration: 0.25, ramp: 110 },
    solve:   { freq: 523, freq2: 659, type: "sine", duration: 0.5 },
  },
  cyberpunk_neon: {
    move:    { freq: 800,  type: "square",   duration: 0.08, ramp: 600 },
    capture: { freq: 200,  type: "sawtooth", duration: 0.2,  ramp: 80  },
    solve:   { freq: 1000, freq2: 1200, type: "square", duration: 0.4 },
  },
  enchanted_wood: {
    move:    { freq: 528, type: "sine",     duration: 0.18, ramp: 396 },
    capture: { freq: 264, type: "triangle", duration: 0.3,  ramp: 132 },
    solve:   { freq: 396, freq2: 528, type: "sine", duration: 0.6 },
  },
  obsidian: {
    move:    { freq: 180, type: "sawtooth", duration: 0.1, ramp: 90 },
    capture: { freq: 100, type: "sawtooth", duration: 0.3, ramp: 50 },
    solve:   { freq: 220, freq2: 330, type: "triangle", duration: 0.5 },
  },
  volcano_forge: {
    move:    { freq: 300, type: "sawtooth", duration: 0.12, ramp: 150 },
    capture: { freq: 150, type: "sawtooth", duration: 0.35, ramp: 60  },
    solve:   { freq: 350, freq2: 500, type: "sawtooth", duration: 0.5 },
  },
  high_contrast: {
    move:    { freq: 500, type: "square",   duration: 0.1,  ramp: 350 },
    capture: { freq: 250, type: "square",   duration: 0.2,  ramp: 120 },
    solve:   { freq: 600, freq2: 800, type: "square", duration: 0.4 },
  },
}

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    try { ctx = new AudioContext() } catch { return null }
  }
  if (ctx.state === "suspended") ctx.resume()
  return ctx
}

function playTone(def: SoundDef) {
  const ac = getCtx()
  if (!ac) return
  try {
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = def.type
    osc.frequency.setValueAtTime(def.freq, ac.currentTime)
    if (def.ramp != null) osc.frequency.exponentialRampToValueAtTime(def.ramp, ac.currentTime + def.duration)
    gain.gain.setValueAtTime(0.18, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + def.duration)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + def.duration + 0.02)

    // optional second tone for solve chord
    if (def.freq2 != null) {
      const osc2  = ac.createOscillator()
      const gain2 = ac.createGain()
      osc2.type = def.type
      osc2.frequency.setValueAtTime(def.freq2, ac.currentTime + 0.08)
      gain2.gain.setValueAtTime(0.14, ac.currentTime + 0.08)
      gain2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + def.duration + 0.08)
      osc2.connect(gain2)
      gain2.connect(ac.destination)
      osc2.start(ac.currentTime + 0.08)
      osc2.stop(ac.currentTime + def.duration + 0.18)
    }
  } catch { /* audio not available */ }
}

export function playMoveSound(themeId: ThemeId) {
  playTone(THEME_SOUNDS[themeId]?.move ?? THEME_SOUNDS.classic.move)
}

export function playCaptureSound(themeId: ThemeId) {
  playTone(THEME_SOUNDS[themeId]?.capture ?? THEME_SOUNDS.classic.capture)
}

export function playSolveSound(themeId: ThemeId) {
  playTone(THEME_SOUNDS[themeId]?.solve ?? THEME_SOUNDS.classic.solve)
}
