import { useEffect, useRef, useState } from 'react'
import { useOptionalController } from '../app/ControllerContext'
import type { PresetId } from '../presets/types'
import { sceneClassName } from './animationMode'
import { createCueSession } from './sceneCueDriver'
import type { SceneRuntime, SceneSettings } from './three/runtime'
import './scene.css'

interface SceneProps { sessionSeed?: number; still?: boolean; paused?: boolean; presetId?: PresetId; ready?: boolean }

export default function Scene({ sessionSeed = 1, still = false, paused = false, presetId = 'rainy-windowsill', ready = true }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<SceneRuntime | null>(null)
  const controller = useOptionalController()
  const latest = useRef({ sessionSeed, controller, enabled: !still, hidden: paused, presetId })
  const [cueSession] = useState(() => createCueSession())

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    let idleHandle: number | null = null
    const canvas = canvasRef.current!
    const cues = cueSession
    void import('./three/runtime').then(({ createSceneRuntime }) => {
      if (cancelled) return
      const initialize = async () => {
        if (cancelled) return
        try {
          const runtime = await createSceneRuntime(canvas, latest.current)
          if (cancelled) { runtime.dispose(); return }
          runtime.update(latest.current)
          runtimeRef.current = runtime
          const input = latest.current
          cues.update({ ...input, source: input.controller, targets: runtime.targets })
        } catch { canvas.dataset.renderer = 'fallback' }
      }
      // Let the loaded circuit and controls paint before allocating the renderer.
      if (typeof window.requestIdleCallback === 'function') idleHandle = window.requestIdleCallback(initialize, { timeout: 1000 })
      else idleHandle = window.setTimeout(initialize, 100)
    }).catch(() => { if (!cancelled) canvas.dataset.renderer = 'fallback' })
    return () => {
      cancelled = true
      if (idleHandle !== null) {
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle)
        else window.clearTimeout(idleHandle)
      }
      cues.stop()
      runtimeRef.current?.dispose()
      runtimeRef.current = null
    }
  }, [cueSession, ready])

  useEffect(() => {
    const settings: SceneSettings = { enabled: !still, hidden: paused, presetId }
    latest.current = { sessionSeed, controller, ...settings }
    runtimeRef.current?.update(settings)
    cueSession.update({ sessionSeed, ...settings, source: controller, targets: runtimeRef.current?.targets ?? null })
    return () => cueSession.stop()
  }, [sessionSeed, controller, still, paused, presetId, cueSession])

  return <div className={sceneClassName({ still, paused })} tabIndex={0} role="img" aria-labelledby="scene-title" aria-describedby="scene-desc">
    <span id="scene-title" className="sr-only">A fruit fly studying beside a banana</span>
    <span id="scene-desc" className="sr-only">A three-dimensional fruit fly with dark bristled chitin, red compound eyes, translucent veined wings, six jointed legs, and headphones rests on a wooden desk beside an open notebook and an overripe banana. Rain falls outside the window and a desk lamp casts warm light.</span>
    <canvas ref={canvasRef} className="scene-canvas" data-testid="scene-canvas" data-renderer="loading" aria-hidden="true" />
  </div>
}
