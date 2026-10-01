import { describe, expect, it, vi } from 'vitest'
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
