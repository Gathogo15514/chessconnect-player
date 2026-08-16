"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface EngineLine {
  depth: number
  scoreCp: number | null   // centipawns, from side-to-move's perspective
  mate: number | null      // moves to mate, if forced
  pvUci: string[]          // principal variation, UCI move list
}

interface UseStockfishResult {
  ready: boolean
  thinking: boolean
  line: EngineLine | null
  bestMoveUci: string | null
  analyze: (fen: string, depth?: number) => void
  stop: () => void
}

/**
 * Single-threaded Stockfish 18 (lite build) run in a dedicated Worker.
 * Files live in /public/stockfish — copied from the `stockfish` npm
 * package's prebuilt bin/ output rather than imported, since a Worker
 * needs a same-origin URL, not a bundled module.
 */
export function useStockfish(): UseStockfishResult {
  const workerRef = useRef<Worker | null>(null)
  const [ready, setReady] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [line, setLine] = useState<EngineLine | null>(null)
  const [bestMoveUci, setBestMoveUci] = useState<string | null>(null)

  useEffect(() => {
    const worker = new Worker("/stockfish/stockfish-18-lite-single.js")
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<string>) => {
      const msg = e.data
      if (msg === "uciok") {
        worker.postMessage("isready")
        return
      }
      if (msg === "readyok") {
        setReady(true)
        return
      }
      if (msg.startsWith("info") && msg.includes("score")) {
        const depthM = msg.match(/depth (\d+)/)
        const cpM = msg.match(/score cp (-?\d+)/)
        const mateM = msg.match(/score mate (-?\d+)/)
        const pvM = msg.match(/ pv (.+)$/)
        if (depthM && pvM) {
          setLine({
            depth: parseInt(depthM[1], 10),
            scoreCp: cpM ? parseInt(cpM[1], 10) : null,
            mate: mateM ? parseInt(mateM[1], 10) : null,
            pvUci: pvM[1].trim().split(" "),
          })
        }
        return
      }
      if (msg.startsWith("bestmove")) {
        const m = msg.match(/bestmove (\S+)/)
        setBestMoveUci(m ? m[1] : null)
        setThinking(false)
      }
    }

    worker.postMessage("uci")

    return () => {
      worker.postMessage("quit")
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const analyze = useCallback((fen: string, depth = 16) => {
    const worker = workerRef.current
    if (!worker) return
    setThinking(true)
    setBestMoveUci(null)
    worker.postMessage("stop")
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${depth}`)
  }, [])

  const stop = useCallback(() => {
    workerRef.current?.postMessage("stop")
    setThinking(false)
  }, [])

  return { ready, thinking, line, bestMoveUci, analyze, stop }
}
