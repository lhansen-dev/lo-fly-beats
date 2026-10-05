import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { getPreset } from '../../presets/presets'
import type { PresetId } from '../../presets/types'
import type { Animatable, CueTargets } from '../sceneCueDriver'
import { createFly } from './flyModel'
import { createRoom } from './roomModel'
import { batchMeshes, disposeObjects } from './geometry'

export interface SceneSettings { enabled: boolean; hidden: boolean; presetId: PresetId }
export interface SceneRuntime { update(settings: SceneSettings): void; dispose(): void; targets: CueTargets }
interface Motion { start: number; duration: number; amount: number }

/** Owns the GPU resources and one bounded animation loop, independent of audio. */
export async function createSceneRuntime(canvas: HTMLCanvasElement, initial: SceneSettings): Promise<SceneRuntime> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#3b4a5a')
  const camera = new THREE.OrthographicCamera(-4, 4, 2.25, -2.25, 0.1, 60)
  camera.position.set(3.35, 2.85, 7.3)
  const room = createRoom()
  const fly = createFly()
  batchMeshes(room.root)
  batchMeshes(fly.root)
  fly.root.position.set(0.14, 0.065, 0.22)
  fly.root.rotation.y = -0.18
  scene.add(room.root, fly.root)
  scene.add(new THREE.HemisphereLight('#d8dece', '#5c4c36', 0.7))
  const key = new THREE.DirectionalLight('#ffe2b2', 2.6)
  key.position.set(-3.5, 6, 4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = key.shadow.camera.bottom = -6
  key.shadow.camera.right = key.shadow.camera.top = 6
  key.shadow.normalBias = 0.025
  key.shadow.bias = -0.0002
  key.shadow.radius = 7
  scene.add(key)
  function createEnvironment(): THREE.WebGLRenderTarget {
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environment = new RoomEnvironment()
    const target = pmrem.fromScene(environment, 0.04)
    environment.dispose()
    pmrem.dispose()
    return target
  }
  let envTarget = createEnvironment()
  scene.environment = envTarget.texture
  scene.environmentIntensity = 0.4
  let settings = initial
  let disposed = false
  let contextLost = false
  let frame: number | null = null
  let lastTime: number | null = null
  let lastRender = 0
  let elapsed = 0
  let paletteRemaining = 0
  let renderedFrames = 0
  const motions: Record<'bob' | 'glint' | 'rub', Motion | null> = { bob: null, glint: null, rub: null }
  const palette = { wall: new THREE.Color(), desk: new THREE.Color(), sky: new THREE.Color(), light: new THREE.Color() }

  function applyPalette(factor: number): void {
    room.wall.color.lerp(palette.wall, factor)
    room.desk.color.lerp(palette.desk, factor)
    room.sky.color.lerp(palette.sky, factor)
    room.windowLight.color.lerp(palette.light, factor)
    ;(scene.background as THREE.Color).copy(room.wall.color)
  }
  function setPalette(presetId: PresetId, snap: boolean): void {
    const visual = getPreset(presetId).visual
    palette.wall.set(visual.wall)
    palette.desk.set(visual.desk).lerp(new THREE.Color('#cbb28d'), 0.2)
    palette.sky.set(visual.windowSky)
    palette.light.set(visual.lightColor)
    canvas.dataset.preset = presetId
    paletteRemaining = snap ? 0 : 1.5
    if (snap) applyPalette(1)
  }
  function pulse(name: keyof typeof motions): number {
    const motion = motions[name]
    if (!motion) return 0
    const t = (elapsed - motion.start) / motion.duration
    if (t >= 1) { motions[name] = null; return 0 }
    return Math.sin(t * Math.PI) * motion.amount
  }
  function animate(): void {
    const bob = pulse('bob'), glint = pulse('glint'), rub = pulse('rub')
    fly.body.position.y = (settings.enabled ? Math.sin(elapsed * 1.1) * 0.009 : 0) - bob * 0.35
    fly.head.rotation.x = bob
    fly.head.rotation.y = glint
    fly.wings.forEach((wing, i) => {
      const settling = settings.enabled ? Math.sin(elapsed * 0.7) ** 24 * 0.035 : 0
      wing.rotation.z = (i === 0 ? -1 : 1) * (0.1 + settling)
    })
    fly.forelegs.forEach((leg, i) => { leg.rotation.y = (i === 0 ? 1 : -1) * rub * Math.sin(elapsed * 18) })
    for (let i = 0; i < 65; i++) {
      const x = -4.55 + (i * 0.618034 % 1) * 6.1
      const phase = i * 0.381966 - elapsed * (0.045 + i % 5 * 0.008)
      const y = 0.84 + ((phase % 1 + 1) % 1) * 3.77
      room.rainPositions.set([x, y, -3.45, x + 0.013, y - 0.065 - i % 3 * 0.025, -3.45], i * 6)
    }
    room.rain.geometry.getAttribute('position').needsUpdate = true
  }
  function render(): void {
    if (disposed || contextLost) return
    renderer.render(scene, camera)
    renderedFrames++
    // Keep diagnostics out of the per-frame DOM mutation path.
    if (renderedFrames === 1 || !settings.enabled || renderedFrames % 10 === 0) canvas.dataset.frameCount = String(renderedFrames)
  }
  function needsLoop(): boolean { return !disposed && !contextLost && !settings.hidden && (settings.enabled || paletteRemaining > 0) }
  function tick(now: number): void {
    frame = null
    if (!needsLoop()) return
    if (now - lastRender >= 1000 / 30) {
      const delta = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.08)
      lastTime = now
      lastRender = now
      if (settings.enabled) elapsed += delta
      if (paletteRemaining > 0) {
        applyPalette(Math.min(1, delta / paletteRemaining))
        paletteRemaining = Math.max(0, paletteRemaining - delta)
      }
      animate()
      render()
    }
    if (needsLoop()) frame = requestAnimationFrame(tick)
  }
  function syncLoop(): void {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    lastTime = null
    canvas.dataset.motion = settings.hidden ? 'paused' : settings.enabled ? 'running' : 'still'
    if (needsLoop()) frame = requestAnimationFrame(tick)
  }
  function resize(): void {
    const width = canvas.clientWidth, height = canvas.clientHeight
    if (!width || !height) return
    const aspect = width / height
    const vertical = aspect < 1.5 ? 4.35 : 4.15
    camera.left = -vertical * aspect / 2
    camera.right = vertical * aspect / 2
    camera.top = vertical / 2
    camera.bottom = -vertical / 2
    camera.lookAt(aspect < 1.5 ? 0.72 : 0.1, 0.8, 0)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    render()
  }
  function target(name: keyof typeof motions): Animatable {
    return { animate(keyframes, options) {
      const amount = name === 'bob' ? String(keyframes[1]?.transform).includes('3px') ? 0.07 : 0.035 : name === 'rub' ? 0.065 : 0.018
      const motion = { start: elapsed, duration: Number(options.duration ?? 520) / 1000, amount }
      motions[name] = motion
      canvas.dataset[`${name}Count`] = String(Number(canvas.dataset[`${name}Count`] ?? 0) + 1)
      return { cancel() { if (motions[name] === motion) motions[name] = null } }
    } }
  }
  function loseContext(event: Event): void {
    event.preventDefault()
    contextLost = true
    canvas.dataset.renderer = 'fallback'
    syncLoop()
  }
  function restoreContext(): void {
    contextLost = false
    envTarget.dispose()
    envTarget = createEnvironment()
    scene.environment = envTarget.texture
    canvas.dataset.renderer = 'webgl'
    render()
    syncLoop()
  }
  setPalette(initial.presetId, true)
  animate()
  // Compile shaders without blocking interaction while the GPU prepares them.
  try { await renderer.compileAsync(scene, camera) } catch (error) {
    disposeObjects(scene)
    key.shadow.dispose()
    envTarget.dispose()
    renderer.dispose()
    throw error
  }
  canvas.addEventListener('webglcontextlost', loseContext)
  canvas.addEventListener('webglcontextrestored', restoreContext)
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  canvas.dataset.renderer = 'webgl'
  syncLoop()
  return {
    targets: { head: target('bob'), eyeShine: target('glint'), handsFront: target('rub') },
    update(next) {
      const changedPreset = next.presetId !== settings.presetId
      settings = next
      if (changedPreset) setPalette(next.presetId, !next.enabled)
      if (!next.enabled) {
        for (const name of ['bob', 'glint', 'rub'] as const) motions[name] = null
        paletteRemaining = 0
        applyPalette(1)
      }
      animate()
      if (!next.hidden) render()
      syncLoop()
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', loseContext)
      canvas.removeEventListener('webglcontextrestored', restoreContext)
      disposeObjects(scene)
      key.shadow.dispose()
      envTarget.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
