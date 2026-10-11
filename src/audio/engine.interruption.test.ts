import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MixSettings } from './rig'

const mock = vi.hoisted(() => {
  const handlers: Array<() => void> = []
  const transport = { bpm: { value: 0, setValueAtTime: vi.fn() }, swing: 0, state: 'stopped', pausedAt: null as number | null, scheduleRepeat: vi.fn(), start: vi.fn(() => { transport.state = 'started' }), pause: vi.fn((time?: number) => { transport.pausedAt = time ?? context.currentTime + context.lookAhead; transport.state = 'paused' }), stop: vi.fn() }
  const context = { currentTime: 5, lookAhead: 0.1, state: 'running' as string, on: vi.fn((name: string, handler: () => void) => { if (name === 'statechange') handlers.push(handler); return context }), rawContext: { suspend: vi.fn(() => Promise.resolve()) }, sampleRate: 44100, transport, draw: { schedule: vi.fn() } }
  const rig = { trigger: vi.fn(), applySound: vi.fn(), setMix: vi.fn(), startAmbience: vi.fn(), stopAmbience: vi.fn(), releaseAll: vi.fn(), rampMasterGain: vi.fn(), keysActiveVoices: 0, dispose: vi.fn() }
  return { handlers, context, transport, rig, start: vi.fn(() => Promise.resolve()), createRig: vi.fn(() => rig) }
})

vi.mock('tone', () => ({ start: mock.start, getContext: () => mock.context }))
vi.mock('./sequencer', () => ({ PlaybackSequencer: class {
  active: unknown
  scoresHeld = 0
  private n = 0
  constructor(_compose: unknown, recipe: unknown) { this.active = recipe }
  reset(_recipe: unknown) {}
  request(_change: unknown) {}
  applyTempoNow(_tempo: number) {}
  advance() {
    const n = this.n++
    return { globalStep: n, phraseIndex: 0, stepInPhrase: n, bar: Math.floor(n / 16), beat: Math.floor((n % 16) / 4), tempoBpm: 90, tempoChanged: false, phraseStarted: null, applied: [], events: [] }
  }
} }))
vi.mock('./rig', async importOriginal => ({ ...(await importOriginal<typeof import('./rig')>()), createRig: mock.createRig }))
const mix = (ambienceOn: boolean): MixSettings => ({ masterVolume: 0.8, ambienceOn, layers: { drums: { level: 0.8, muted: false }, bass: { level: 0.7, muted: false }, keys: { level: 0.6, muted: false }, lead: { level: 0.55, muted: false } } })
const graph = { manifest: { version: 1 } } as never
const recipe = { presetId: 'overripe-2am', tempoBpm: 90, variation: 0.5, sessionSeed: 1 } as never
async function freshEngine() { vi.resetModules(); return (await import('./engine')).getEngine() }
function interrupt() { mock.context.state = 'suspended'; mock.handlers.forEach(handler => handler()) }
beforeEach(() => {
  vi.stubGlobal('document', { hidden: false })
  mock.context.draw.schedule.mockClear()
  mock.handlers.length = 0; mock.context.state = 'running'; mock.context.currentTime = 5; mock.context.lookAhead = 0.1; mock.transport.pausedAt = null
  mock.start.mockReset().mockImplementation(() => Promise.resolve())
  mock.transport.scheduleRepeat.mockClear(); mock.transport.start.mockClear(); mock.transport.pause.mockClear()
  for (const fn of [mock.rig.setMix, mock.rig.startAmbience, mock.rig.stopAmbience, mock.rig.releaseAll, mock.rig.rampMasterGain]) fn.mockClear()
})
async function playing() { const engine = await freshEngine(); await engine.start(graph, recipe, mix(true)); mock.start.mockClear(); mock.transport.start.mockClear(); mock.transport.pause.mockClear(); mock.transport.scheduleRepeat.mockClear(); for (const fn of [mock.rig.setMix, mock.rig.startAmbience, mock.rig.stopAmbience, mock.rig.releaseAll, mock.rig.rampMasterGain]) fn.mockClear(); return engine }

describe('audio interruption', () => {
  it('interrupts active playback without ramping gain', async () => { const e = await playing(); interrupt(); expect(e.getDiagnostics().status).toBe('interrupted'); expect(mock.transport.pause).toHaveBeenCalledWith(5); expect(mock.transport.pausedAt).toBe(5); expect(mock.rig.releaseAll).toHaveBeenCalledWith(5); expect(mock.rig.stopAmbience).toHaveBeenCalledWith(5); expect(mock.rig.rampMasterGain).not.toHaveBeenCalled() })
  it('does not treat an intentional pause as an interruption', async () => { const e = await playing(); e.pause(); interrupt(); expect(e.getDiagnostics().status).toBe('paused') })
  it('resumes interrupted playback without scheduling another repeat', async () => { const e = await playing(); interrupt(); mock.context.state = 'running'; await e.play(); expect(mock.start).toHaveBeenCalledTimes(1); expect(mock.transport.start).toHaveBeenCalled(); expect(e.getDiagnostics()).toMatchObject({ status: 'playing', repeatEvents: 1 }); expect(mock.transport.scheduleRepeat).not.toHaveBeenCalled() })
  it('shares a pending resume operation', async () => { const e = await playing(); interrupt(); let resolve!: () => void; mock.start.mockImplementation(() => new Promise<void>(r => { resolve = r })); mock.context.state = 'running'; const a = e.play()!; const b = e.play()!; expect(a).toBe(b); expect(mock.start).toHaveBeenCalledTimes(1); resolve(); await a })
  it('invalidates a pending resume during export', async () => { const e = await playing(); interrupt(); let resolve!: () => void; mock.start.mockImplementation(() => new Promise<void>(r => { resolve = r })); const p = e.play()!; e.beginExport(); e.endExport(); mock.context.state = 'running'; resolve(); await p; expect(mock.transport.start).not.toHaveBeenCalled(); expect(e.getDiagnostics().status).toBe('paused'); await e.play(); expect(e.getDiagnostics().status).toBe('playing'); expect(mock.transport.start).toHaveBeenCalledTimes(1) })
  it('does not resume if context remains suspended after Tone.start', async () => { const e = await playing(); interrupt(); let resolve!: () => void; mock.start.mockImplementationOnce(() => new Promise<void>(r => { resolve = r })); const p = e.play()!; resolve(); await p; expect(e.getDiagnostics().status).toBe('interrupted'); expect(mock.transport.start).not.toHaveBeenCalled(); expect(mock.rig.startAmbience).not.toHaveBeenCalled(); mock.context.state = 'running'; await e.play(); expect(e.getDiagnostics().status).toBe('playing'); expect(mock.start).toHaveBeenCalledTimes(2) })
  it('clears rejected resume operations for retry', async () => { const e = await playing(); interrupt(); mock.start.mockImplementationOnce(() => Promise.reject(new Error('blocked'))); await expect(e.play()).resolves.toBeUndefined(); expect(e.getDiagnostics().status).toBe('interrupted'); expect(mock.transport.start).not.toHaveBeenCalled(); mock.context.state = 'running'; await e.play(); expect(mock.start).toHaveBeenCalledTimes(2); expect(e.getDiagnostics().status).toBe('playing') })
  it('debugInterrupt suspends the raw context', async () => { const e = await playing(); e.debugInterrupt(); expect(mock.context.rawContext.suspend).toHaveBeenCalledTimes(1) })
  it('drops draw callbacks queued before an interruption', async () => {
    const engine = await freshEngine(); await engine.start(graph, recipe, mix(true))
    const tick = mock.transport.scheduleRepeat.mock.calls[0][0] as (time: number) => void
    const steps: unknown[] = []; const positions: unknown[] = []
    engine.on('step', event => steps.push(event)); engine.on('position', event => positions.push(event))
    tick(1); const stale = mock.context.draw.schedule.mock.calls.at(-1)![0] as () => void
    interrupt(); stale(); expect(steps).toHaveLength(0); expect(positions).toHaveLength(0)
    mock.context.state = 'running'; await engine.play(); stale(); expect(steps).toHaveLength(0); expect(positions).toHaveLength(0)
    tick(2); (mock.context.draw.schedule.mock.calls.at(-1)![0] as () => void)()
    expect(steps).toHaveLength(1)
  })
  it('does not advance the sequencer while interrupted', async () => {
    const engine = await freshEngine(); await engine.start(graph, recipe, mix(true))
    const tick = mock.transport.scheduleRepeat.mock.calls[0][0] as (time: number) => void
    const events: unknown[] = []; engine.on('step', event => events.push(event)); engine.on('position', event => events.push(event))
    interrupt(); mock.context.draw.schedule.mockClear(); tick(6)
    expect(mock.context.draw.schedule).not.toHaveBeenCalled(); expect(events).toHaveLength(0)
  })
  it('pauses at currentTime, not currentTime + lookAhead, and resumes from the saved step', async () => {
    mock.context.currentTime = 7.25
    const engine = await freshEngine(); await engine.start(graph, recipe, mix(true))
    const tick = mock.transport.scheduleRepeat.mock.calls[0][0] as (time: number) => void
    const steps: Array<{ stepInPhrase: number }> = []; engine.on('step', event => steps.push(event))
    for (let n = 0; n < 3; n++) { tick(n); (mock.context.draw.schedule.mock.calls.at(-1)![0] as () => void)() }
    interrupt()
    expect(mock.transport.pause).toHaveBeenLastCalledWith(7.25); expect(mock.transport.pausedAt).toBe(7.25); expect(engine.getDiagnostics().status).toBe('interrupted')
    tick(4); mock.context.state = 'running'; await engine.play()
    tick(5); (mock.context.draw.schedule.mock.calls.at(-1)![0] as () => void)()
    expect(steps.at(-1)?.stepInPhrase).toBe(3); expect(engine.getDiagnostics().status).toBe('playing')
  })
  it('resumes from the saved step', async () => {
    const engine = await freshEngine(); await engine.start(graph, recipe, mix(true))
    const tick = mock.transport.scheduleRepeat.mock.calls[0][0] as (time: number) => void
    const steps: Array<{ stepInPhrase: number }> = []; engine.on('step', event => steps.push(event))
    for (let n = 0; n < 3; n++) { tick(n); (mock.context.draw.schedule.mock.calls.at(-1)![0] as () => void)() }
    expect(steps.map(step => step.stepInPhrase)).toEqual([0, 1, 2])
    interrupt(); tick(4); mock.context.state = 'running'; await engine.play()
    tick(5); (mock.context.draw.schedule.mock.calls.at(-1)![0] as () => void)()
    expect(steps.at(-1)?.stepInPhrase).toBe(3); expect(engine.getDiagnostics().repeatEvents).toBe(1)
  })
})
