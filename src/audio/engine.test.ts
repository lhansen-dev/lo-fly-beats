import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MixSettings } from './rig'
import type { PreparedScoreProvider } from './sequencer'

const mock = vi.hoisted(() => {
  const calls: Array<{ method: string; args: unknown[] }> = []
  let resolveStart: (() => void) | undefined
  const transport = { bpm: { value: 0, setValueAtTime: vi.fn() }, swing: 0, state: 'stopped', scheduleRepeat: vi.fn(), start: vi.fn(() => { transport.state = 'started' }), pause: vi.fn(() => { transport.state = 'paused' }), stop: vi.fn() }
  const context = { currentTime: 5, state: 'running' as string, on: vi.fn(() => mock.context), rawContext: { suspend: vi.fn(() => Promise.resolve()) }, sampleRate: 44100, transport, draw: { schedule: vi.fn() } }
  const rig = { trigger: vi.fn(), applySound: vi.fn(), setMix: vi.fn((...args: unknown[]) => calls.push({ method: 'setMix', args })), startAmbience: vi.fn((...args: unknown[]) => calls.push({ method: 'startAmbience', args })), stopAmbience: vi.fn((...args: unknown[]) => calls.push({ method: 'stopAmbience', args })), releaseAll: vi.fn((...args: unknown[]) => calls.push({ method: 'releaseAll', args })), rampMasterGain: vi.fn((...args: unknown[]) => calls.push({ method: 'rampMasterGain', args })), keysActiveVoices: 0, dispose: vi.fn() }
  return { calls, context, transport, rig, resolveStart, start: vi.fn(() => Promise.resolve()), createRig: vi.fn(() => rig) }
})

vi.mock('tone', () => ({ start: mock.start, getContext: () => mock.context }))
vi.mock('./rig', async importOriginal => ({ ...(await importOriginal<typeof import('./rig')>()), createRig: mock.createRig }))

const mix = (ambienceOn: boolean, masterVolume = 0.8): MixSettings => ({ masterVolume, ambienceOn, layers: { drums: { level: 0.8, muted: false }, bass: { level: 0.7, muted: false }, keys: { level: 0.6, muted: false }, lead: { level: 0.55, muted: false } } })
const graph = { manifest: { version: 1 } } as never
const recipe = { presetId: 'overripe-2am', tempoBpm: 90, variation: 0.5, sessionSeed: 1 } as never

async function freshEngine() {
  vi.resetModules()
  const module = await import('./engine')
  return module.getEngine()
}

beforeEach(() => {
  mock.calls.length = 0
  mock.start.mockReset().mockImplementation(() => Promise.resolve())
  mock.createRig.mockClear()
  mock.transport.scheduleRepeat.mockClear()
  mock.transport.start.mockClear()
  mock.transport.pause.mockClear()
  mock.context.currentTime = 5
  mock.context.state = 'running'
})

describe('export lock', () => {
  it('locks playback during export and resumes paused playback afterward', async () => {
    const engine = await freshEngine()
    await engine.start(graph, recipe, mix(true))
    engine.beginExport()
    expect(engine.getDiagnostics()).toMatchObject({ status: 'exporting', exportInProgress: true })
    expect(mock.transport.pause).toHaveBeenCalled()

    mock.transport.start.mockClear()
    mock.start.mockClear()
    engine.play()
    await engine.start(graph, recipe, mix(true))
    expect(mock.transport.start).not.toHaveBeenCalled()
    expect(mock.start).not.toHaveBeenCalled()
    expect(mock.transport.scheduleRepeat).toHaveBeenCalledTimes(1)

    engine.endExport()
    expect(engine.getDiagnostics()).toMatchObject({ status: 'paused', exportInProgress: false })
    engine.play()
    expect(engine.getDiagnostics().status).toBe('playing')
  })

  it('does nothing when export begins before the engine starts', async () => {
    const engine = await freshEngine()
    engine.beginExport()
    expect(engine.getDiagnostics().status).toBe('idle')
  })
})

describe('live mix lifecycle', () => {
  it('routes mix to context time, and only transitions ambience during playback', async () => {
    const engine = await freshEngine()
    await engine.start(graph, recipe, mix(true))
    expect(mock.rig.setMix).toHaveBeenLastCalledWith(expect.anything(), 5)
    mock.context.currentTime = 9
    engine.setMix(mix(true, 0.4))
    expect(mock.rig.startAmbience).toHaveBeenCalledTimes(1)
    engine.setMix(mix(false))
    expect(mock.rig.stopAmbience).toHaveBeenLastCalledWith(9)
    engine.setMix(mix(false, 0.3))
    expect(mock.rig.stopAmbience).toHaveBeenCalledTimes(1)
  })

  it('applies the latest mix after Tone.start resolves', async () => {
    const engine = await freshEngine()
    let resolveStart!: () => void
    mock.start.mockImplementation(() => new Promise<void>(resolve => { resolveStart = resolve }))
    const pending = engine.start(graph, recipe, mix(true))
    engine.setMix(mix(false, 0.25))
    resolveStart()
    await pending
    expect(mock.createRig).toHaveBeenCalledWith(mock.context, expect.anything(), expect.objectContaining({ masterVolume: 0.25, ambienceOn: false }))
    expect(mock.rig.startAmbience).not.toHaveBeenCalled()
    expect(mock.transport.scheduleRepeat).toHaveBeenCalledTimes(1)
  })

  it('fades, releases and restores latest master level on pause; paused edits apply on resume', async () => {
    const engine = await freshEngine()
    await engine.start(graph, recipe, mix(true))
    mock.rig.startAmbience.mockClear()
    mock.context.currentTime = 10
    engine.setMix(mix(false, 0.45))
    engine.pause()
    expect(mock.rig.stopAmbience).toHaveBeenLastCalledWith(10)
    expect(mock.rig.rampMasterGain).toHaveBeenLastCalledWith(0.45, 0.03, 10.12)
    expect(mock.rig.releaseAll).toHaveBeenLastCalledWith(10.09)
    engine.setMix(mix(true, 0.3))
    expect(mock.rig.startAmbience).not.toHaveBeenCalled()
    engine.play()
    expect(mock.rig.startAmbience).toHaveBeenLastCalledWith(10)
    expect(mock.transport.state).toBe('started')
    engine.setMix(mix(false))
    engine.setMix(mix(false, 0.2))
    expect(engine.getDiagnostics()).toMatchObject({ status: 'playing', repeatEvents: 1 })
    expect(mock.transport.scheduleRepeat).toHaveBeenCalledTimes(1)
  })
})


describe('prepared learning transport', () => {
  it('waits for the first score before starting one scheduler, including after a paused reset', async () => {
    const engine = await freshEngine()
    let release!: () => void
    const provider: PreparedScoreProvider = {
      initialPhraseIndex: 3, scoresHeld: 1, take: vi.fn(), update: vi.fn(), reset: vi.fn(),
      ensureReady: vi.fn(() => new Promise<void>(resolve => { release = resolve })),
    }
    const starting = engine.start(graph, recipe, mix(false), provider)
    await Promise.resolve()
    expect(mock.transport.scheduleRepeat).not.toHaveBeenCalled()
    release()
    await starting
    expect(mock.transport.scheduleRepeat).toHaveBeenCalledTimes(1)
    engine.pause()
    engine.reset(recipe)
    expect(provider.reset).toHaveBeenCalledWith(recipe)
    mock.transport.start.mockClear()
    const playing = engine.play()
    await Promise.resolve()
    expect(mock.transport.start).not.toHaveBeenCalled()
    release()
    await playing
    expect(mock.transport.start).toHaveBeenCalledTimes(1)
    expect(mock.transport.scheduleRepeat).toHaveBeenCalledTimes(1)
  })

  it('keeps the baseline player available when initial learning preparation fails', async () => {
    const engine = await freshEngine()
    const provider: PreparedScoreProvider = {
      initialPhraseIndex: 0, scoresHeld: 0, take: vi.fn(), update: vi.fn(), reset: vi.fn(),
      ensureReady: vi.fn(() => Promise.reject(new Error('worker failed'))),
    }
    await engine.start(graph, recipe, mix(false), provider)
    expect(engine.getDiagnostics()).toMatchObject({ status: 'playing', repeatEvents: 1 })
    expect(provider.take).not.toHaveBeenCalled()
  })
})
