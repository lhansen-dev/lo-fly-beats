import { describe, expect, it, vi } from 'vitest'
import type { ExportSnapshot } from '../audio/export'
import type { WavData } from '../audio/wav'
import type { EngineEventMap, EngineLike } from '../audio/engine'
import { CircuitError } from '../connectome/types'
import type { CircuitGraph } from '../connectome/types'
import type { PhraseScore } from '../music/types'
import { appReducer, createInitialState } from './state'
import { createStore } from './store'
import { SessionController } from './controller'

type Call = { method: string; arg: unknown }

class FakeEngine implements EngineLike {
  calls: Call[] = []
  handlers = new Map<string, Set<(payload: never) => void>>()

  on<K extends keyof EngineEventMap>(name: K, handler: (payload: EngineEventMap[K]) => void): () => void {
    let set = this.handlers.get(name)
    if (!set) { set = new Set(); this.handlers.set(name, set) }
    set.add(handler as (payload: never) => void)
    return () => { set?.delete(handler as (payload: never) => void) }
  }

  emit<K extends keyof EngineEventMap>(name: K, payload: EngineEventMap[K]): void {
    this.handlers.get(name)?.forEach(handler => handler(payload as never))
  }

  async start(graph: CircuitGraph, recipe: Parameters<EngineLike['start']>[1], mix: Parameters<EngineLike['start']>[2]): Promise<void> {
    this.calls.push({ method: 'start', arg: [graph, recipe, mix] })
  }
  setMix(mix: Parameters<EngineLike['setMix']>[0]): void { this.calls.push({ method: 'setMix', arg: mix }) }
  play(): void { this.calls.push({ method: 'play', arg: undefined }) }
  debugInterrupt(): void { this.calls.push({ method: 'debugInterrupt', arg: undefined }) }
  pause(): void { this.calls.push({ method: 'pause', arg: undefined }) }
  beginExport(): void { this.calls.push({ method: 'beginExport', arg: undefined }); this.emit('status', 'exporting') }
  endExport(): void { this.calls.push({ method: 'endExport', arg: undefined }); this.emit('status', 'paused') }
  reset(recipe: Parameters<EngineLike['reset']>[0]): void { this.calls.push({ method: 'reset', arg: recipe }) }
  request(change: Parameters<EngineLike['request']>[0]): void { this.calls.push({ method: 'request', arg: change }) }
  applyTempoNow(tempoBpm: number): void { this.calls.push({ method: 'applyTempoNow', arg: tempoBpm }) }
  getDiagnostics(): ReturnType<EngineLike['getDiagnostics']> { return { contextState: 'running', status: 'playing', transportState: 'started', sampleRate: 44100, repeatEvents: 1, scoresHeld: 0, keysActiveVoices: 0, exportInProgress: false } }
}

const graph = { manifest: { version: 1 } } as unknown as CircuitGraph

function setup(loadGraph = async () => graph) {
  const store = createStore(appReducer, createInitialState(null))
  const engine = new FakeEngine()
  const saves: unknown[] = []
  const controller = new SessionController({ store, loadGraph, createEngine: async () => engine, saveSettings: settings => saves.push(settings) })
  return { store, engine, saves, controller }
}

describe('controller export', () => {
  const wav: WavData = { sampleRate: 44100, channels: [new Float32Array(4), new Float32Array(4)] }

  function exportSetup(render: (snapshot: ExportSnapshot) => Promise<WavData> = async () => wav) {
    const store = createStore(appReducer, createInitialState(null))
    const engine = new FakeEngine()
    const renderPhrase = vi.fn(render)
    const revokeObjectUrl = vi.fn()
    let sequence = 0
    const controller = new SessionController({ store, loadGraph: async () => graph, createEngine: async () => engine, saveSettings: () => undefined, renderPhrase, createObjectUrl: () => `blob:${++sequence}`, revokeObjectUrl })
    return { store, engine, controller, renderPhrase, revokeObjectUrl }
  }

  async function withScore(setupResult: ReturnType<typeof exportSetup>) {
    const { controller, store, engine } = setupResult
    await controller.loadCircuit()
    await controller.startListening()
    store.dispatch({ type: 'engineStatusChanged', status: 'playing' })
    const score = { scoreVersion: 1, phraseIndex: 0, events: [] } as unknown as PhraseScore
    engine.emit('phraseStarted', { score, recipe: store.getState().active })
    return score
  }

  it('renders the active phrase snapshot, reports progress, and holds the WAV URL', async () => {
    const subject = exportSetup()
    const score = await withScore(subject)
    subject.controller.setTempo(90)
    subject.controller.setVariation(0.9)
    const statuses: string[] = []
    subject.store.subscribe(() => {
      const status = subject.store.getState().exportState.status
      if (statuses.at(-1) !== status) statuses.push(status)
    })
    await subject.controller.exportPhrase()
    expect(subject.renderPhrase.mock.calls[0][0]).toMatchObject({ score, recipe: { tempoBpm: 72, variation: 0 } })
    expect(statuses).toEqual(['preparing', 'rendering', 'encoding', 'ready'])
    expect(subject.store.getState().exportState).toMatchObject({ status: 'ready', fileName: 'lofly-rainy-windowsill-seed-00000001.wav', url: 'blob:1' })
    expect(subject.engine.calls.map(call => call.method)).toContain('beginExport')
    expect(subject.store.getState().engineStatus).toBe('paused')
    expect(subject.renderPhrase).toHaveBeenCalledTimes(1)
    expect(subject.engine.calls.at(-1)?.method).toBe('endExport')
    expect(subject.store.getState().engineStatus).toBe('paused')
    expect(subject.controller.getDiagnostics()?.objectUrlsHeld).toBe(1)
  })

  it('guards concurrent exports and revokes held URLs on replacement and dismissal', async () => {
    let resolve!: (value: WavData) => void
    const subject = exportSetup(() => new Promise(res => { resolve = res }))
    await withScore(subject)
    const first = subject.controller.exportPhrase()
    const second = subject.controller.exportPhrase()
    expect(subject.renderPhrase).toHaveBeenCalledTimes(1)
    resolve(wav)
    await Promise.all([first, second])
    subject.renderPhrase.mockImplementation(async () => wav)
    await subject.controller.exportPhrase()
    expect(subject.revokeObjectUrl).toHaveBeenCalledWith('blob:1')
    expect(subject.controller.getDiagnostics()?.objectUrlsHeld).toBe(1)
    subject.controller.dismissExport()
    expect(subject.revokeObjectUrl).toHaveBeenCalledWith('blob:2')
    expect(subject.controller.getDiagnostics()?.objectUrlsHeld).toBe(0)
    expect(subject.store.getState().exportState.status).toBe('idle')
  })

  it('reports render errors and permits retry', async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error('render failed')).mockResolvedValue(wav)
    const subject = exportSetup(render)
    await withScore(subject)
    await subject.controller.exportPhrase()
    expect(subject.store.getState().exportState).toMatchObject({ status: 'error', message: 'render failed' })
    expect(subject.store.getState().engineStatus).toBe('paused')
    expect(subject.engine.calls.at(-1)?.method).toBe('endExport')
    await subject.controller.exportPhrase()
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('does not start export without an active score', async () => {
    const subject = exportSetup()
    await subject.controller.loadCircuit()
    await subject.controller.startListening()
    await subject.controller.exportPhrase()
    expect(subject.engine.calls.some(call => call.method === 'beginExport')).toBe(false)
  })
})

describe('controller interruption', () => {
  it('surfaces interruption notice and clears it when playing resumes', async () => {
    const { controller, store, engine } = setup()
    await controller.loadCircuit()
    await controller.startListening()
    engine.emit('status', 'interrupted')
    expect(store.getState().audioNotice).toBe('Audio was interrupted by the browser. Press Play to resume.')
    expect(store.getState().engineStatus).toBe('interrupted')
    engine.emit('status', 'playing')
    expect(store.getState().audioNotice).toBeNull()
  })

  it('exposes the engine interruption debug hook', async () => {
    const { controller, engine } = setup()
    await controller.loadCircuit()
    await controller.startListening()
    controller.simulateInterruption()
    expect(engine.calls).toContainEqual({ method: 'debugInterrupt', arg: undefined })
  })
})

describe('controller mix settings', () => {
  it('merges sequential nested patches immutably and saves the current complete mix', async () => {
    const { controller, store, engine, saves } = setup()
    const initial = store.getState().mix
    controller.setMix({ layers: { drums: { muted: true } } })
    expect(store.getState().mix.layers.drums).toEqual({ level: initial.layers.drums.level, muted: true })
    controller.setMix({ layers: { drums: { level: 0.25 }, bass: { level: 0, muted: false } }, masterVolume: 0, ambienceOn: false })
    const merged = store.getState().mix
    expect(merged).toEqual({ masterVolume: 0, ambienceOn: false, layers: { drums: { level: 0.25, muted: true }, bass: { level: 0, muted: false }, keys: initial.layers.keys } })
    expect(initial.layers.drums).toEqual({ level: 0.8, muted: false })
    expect(store.getState().pending).toEqual({})
    expect(store.getState().active).toEqual(createInitialState(null).active)
    expect(engine.calls).toEqual([])
    expect(saves).toHaveLength(2)
    expect(saves.map(save => (save as { mix: unknown }).mix)).toEqual([expect.objectContaining({ layers: expect.objectContaining({ drums: { level: 0.8, muted: true } }) }), merged])

    await controller.loadCircuit()
    await controller.startListening()
    expect(engine.calls.find(call => call.method === 'start')?.arg).toEqual([graph, store.getState().active, merged])
    controller.setMix({ layers: { keys: { muted: true } } })
    expect(engine.calls.filter(call => call.method === 'setMix')).toEqual([{ method: 'setMix', arg: store.getState().mix }])
    expect(store.getState().mix.layers.keys).toEqual({ level: initial.layers.keys.level, muted: true })
    expect(store.getState().active).toEqual(createInitialState(null).active)
    expect(store.getState().pending).toEqual({})
    expect((saves.at(-1) as { mix: unknown }).mix).toEqual(store.getState().mix)
  })

  it('retains initialized paused edits for resume without restarting playback', async () => {
    const { controller, store, engine } = setup()
    await controller.loadCircuit()
    await controller.startListening()
    store.dispatch({ type: 'engineStatusChanged', status: 'paused' })
    controller.setMix({ layers: { bass: { muted: true } } })
    expect(engine.calls.filter(call => call.method === 'setMix')).toHaveLength(1)
    expect(engine.calls.filter(call => ['pause', 'play', 'reset', 'start'].includes(call.method))).toHaveLength(1)
    expect(store.getState().mix.layers.bass).toEqual({ level: 0.7, muted: true })
  })
})

describe('SessionController', () => {
  it('loads a circuit successfully', async () => {
    const { controller, store } = setup()
    await controller.loadCircuit()
    expect(store.getState().circuit).toEqual({ status: 'ready', manifest: graph.manifest, error: null })
  })

  it('records circuit errors', async () => {
    const { controller, store } = setup(async () => { throw new CircuitError('network', 'boom') })
    await controller.loadCircuit()
    expect(store.getState().circuit).toEqual({ status: 'error', manifest: null, error: { code: 'network', message: 'boom' } })
  })

  it('starts once concurrently with active recipe and mix', async () => {
    const { controller, store, engine } = setup()
    await controller.loadCircuit()
    const first = controller.startListening()
    const second = controller.startListening()
    await Promise.all([first, second])
    expect(engine.calls.filter(call => call.method === 'start')).toHaveLength(1)
    expect(engine.calls[0].arg).toEqual([graph, store.getState().active, store.getState().mix])
  })

  it('routes engine events into state and saves applied settings', async () => {
    const { controller, store, engine, saves } = setup()
    await controller.loadCircuit()
    await controller.startListening()
    engine.emit('status', 'playing')
    const score = { scoreVersion: 1, phraseIndex: 2 } as PhraseScore
    engine.emit('phraseStarted', { score, recipe: store.getState().active })
    const recipe = { ...store.getState().active, variation: 0.4 }
    engine.emit('applied', { kinds: ['variation'], recipe })
    const position = { phraseIndex: 2, bar: 1, beat: 3 }
    engine.emit('position', position)
    expect(store.getState().engineStatus).toBe('playing')
    expect(store.getState().activeScore).toBe(score)
    expect(store.getState().active).toEqual(recipe)
    expect(store.getState().position).toEqual(position)
    expect(saves).toHaveLength(1)
    expect(store.getState().pending).toEqual({})
  })

  it('applies controls immediately before the first start and saves settings', () => {
    const store = createStore(appReducer, createInitialState(null))
    const saves: unknown[] = []
    const controller = new SessionController({ store, createEngine: async () => new FakeEngine(), loadGraph: async () => graph, saveSettings: value => saves.push(value), randomSeed: () => 123 })
    controller.setTempo(110)
    controller.setVariation(0.6)
    controller.newBeat()
    controller.selectPreset('overripe-2am')
    expect(store.getState().active).toMatchObject({ tempoBpm: 64, variation: 0.6, sessionSeed: 123, presetId: 'overripe-2am' })
    expect(store.getState().pending).toEqual({})
    expect(saves).toHaveLength(4)
    expect(saves.map(value => (value as { tempoBpm: number }).tempoBpm)).toEqual([110, 110, 110, store.getState().active.tempoBpm])
  })

  it('routes playing controls to requests and clears pending on applied', async () => {
    const { controller, store, engine } = setup()
    await controller.loadCircuit()
    await controller.startListening()
    store.dispatch({ type: 'engineStatusChanged', status: 'playing' })
    const original = store.getState().active
    controller.setTempo(111)
    expect(engine.calls.at(-1)).toEqual({ method: 'request', arg: { kind: 'tempo', tempoBpm: 111 } })
    expect(store.getState().active).toEqual(original)
    expect(store.getState().pending).toEqual({ tempoBpm: 111 })
    engine.emit('applied', { kinds: ['tempo'], recipe: { ...original, tempoBpm: 111 } })
    expect(store.getState().pending).toEqual({})
    controller.setVariation(0.4)
    expect(engine.calls.at(-1)).toEqual({ method: 'request', arg: { kind: 'variation', variation: 0.4 } })
    controller.newBeat()
    expect(engine.calls.at(-1)).toEqual({ method: 'request', arg: { kind: 'newBeat', sessionSeed: expect.any(Number) } })
    controller.selectPreset('overripe-2am')
    expect(engine.calls.at(-1)).toEqual({ method: 'request', arg: { kind: 'preset', presetId: 'overripe-2am', tempoBpm: expect.any(Number) } })
  })

  it('uses immediate engine operations while paused', async () => {
    const { controller, store, engine } = setup()
    await controller.loadCircuit()
    await controller.startListening()
    controller.setTempo(112)
    expect(engine.calls.at(-1)).toEqual({ method: 'applyTempoNow', arg: 112 })
    controller.setVariation(0.5)
    expect(engine.calls.at(-1)).toEqual({ method: 'request', arg: { kind: 'variation', variation: 0.5 } })
    controller.newBeat()
    expect(engine.calls.at(-1)).toMatchObject({ method: 'reset', arg: { sessionSeed: store.getState().active.sessionSeed } })
    controller.selectPreset('overripe-2am')
    expect(engine.calls.at(-1)).toMatchObject({ method: 'reset', arg: { presetId: 'overripe-2am', tempoBpm: store.getState().active.tempoBpm } })
    expect(store.getState().pending).toEqual({ variation: 0.5 })
  })

  it('toggles playback according to status', async () => {
    const { controller, store, engine } = setup()
    await controller.loadCircuit()
    await controller.startListening()
    store.dispatch({ type: 'engineStatusChanged', status: 'playing' })
    controller.togglePlay()
    store.dispatch({ type: 'engineStatusChanged', status: 'paused' })
    controller.togglePlay()
    expect(engine.calls.slice(-2).map(call => call.method)).toEqual(['pause', 'play'])
  })
})
