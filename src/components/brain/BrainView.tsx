import { useEffect, useMemo, useRef } from 'react'
import { useController } from '../../app/ControllerContext'
import { useAppState } from '../../app/store'
import type { BrainAtlas } from '../../brain/protocol'
import type { NeuronRole } from '../../brain/circuit'
import { ROLE_STYLE } from './roleStyle'

interface Layout { x: Float32Array; y: Float32Array; located: number[] }

/** Soma X-Z positions fitted to the canvas at one uniform scale, the fly's left on the left. */
function layout(atlas: BrainAtlas, width: number, height: number, margin: number): Layout {
  const count = atlas.ids.length
  const located: number[] = []
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (let index = 0; index < count; index++) {
    const x = atlas.positions[index * 2]!
    const z = atlas.positions[index * 2 + 1]!
    if (Number.isNaN(x) || Number.isNaN(z)) continue
    located.push(index)
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }
  const scale = Math.min((width - 2 * margin) / Math.max(1, maxX - minX), (height - 2 * margin) / Math.max(1, maxZ - minZ))
  const offsetX = (width - (maxX - minX) * scale) / 2
  const offsetY = (height - (maxZ - minZ) * scale) / 2
  const xs = new Float32Array(count)
  const ys = new Float32Array(count)
  for (const index of located) {
    xs[index] = offsetX + (maxX - atlas.positions[index * 2]!) * scale
    ys[index] = offsetY + (atlas.positions[index * 2 + 1]! - minZ) * scale
  }
  return { x: xs, y: ys, located }
}

const WIDTH = 720
const HEIGHT = 520

export default function BrainView() {
  const controller = useController()
  const brain = useAppState(state => state.brain)
  const position = useAppState(state => state.position)
  const engineStatus = useAppState(state => state.engineStatus)
  const canvas = useRef<HTMLCanvasElement>(null)
  const atlas = brain?.status === 'ready' || brain?.playing ? controller.getBrainAtlas() : null
  const geometry = useMemo(() => atlas ? layout(atlas, WIDTH, HEIGHT, 26) : null, [atlas])
  const phraseId = brain?.playing?.id ?? null
  const beat = position.bar * 4 + position.beat

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context || !atlas || !geometry) return
    const ratio = globalThis.devicePixelRatio || 1
    if (canvas.current!.width !== WIDTH * ratio) {
      canvas.current!.width = WIDTH * ratio
      canvas.current!.height = HEIGHT * ratio
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, WIDTH, HEIGHT)
    const frames = phraseId && engineStatus !== 'idle' ? controller.getBrainFrames(phraseId) : null
    const size = atlas.ids.length
    for (const index of geometry.located) {
      const rate = frames ? Math.abs(frames[beat * size + index]! / 127) : 0
      const role = atlas.roles[index]!
      context.globalAlpha = 0.18 + 0.82 * rate
      context.fillStyle = ROLE_STYLE[role].color
      context.beginPath()
      context.arc(geometry.x[index]!, geometry.y[index]!, 1.1 + 3.4 * rate, 0, Math.PI * 2)
      context.fill()
    }
    context.globalAlpha = 1
  }, [atlas, geometry, phraseId, beat, engineStatus, controller])

  if (!brain) return null
  const located = geometry?.located.length ?? 0
  return <figure className="brain-view" data-testid="brain-view">
    <canvas ref={canvas} className="brain-canvas" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }} role="img"
      aria-label={atlas ? `The fly's song circuit: ${located.toLocaleString()} neurons at their measured cell-body positions, brightening with simulated activity on each beat.` : 'The fly brain is loading.'} />
    <figcaption>
      <ul className="brain-legend">{(Object.keys(ROLE_STYLE) as NeuronRole[]).map(role => <li key={role}><span style={{ background: ROLE_STYLE[role].color }} />{ROLE_STYLE[role].label}</li>)}</ul>
      <p className="brain-caption">Front view of measured cell bodies (MaleCNS X–Z, the fly's left on the left). Brightness is the modeled firing rate at this beat{atlas ? `; ${(atlas.ids.length - located).toLocaleString()} neurons without a recorded position are not drawn` : ''}.</p>
    </figcaption>
  </figure>
}
