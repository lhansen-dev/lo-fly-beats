import { describe, expect, it } from 'vitest'
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
  pause(): void { this.calls.push({ method: 'pause', arg: undefined }) }
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
