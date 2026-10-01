import type { EngineDiagnostics, EngineLike } from '../audio/engine'
import type { PendingChange } from '../audio/sequencer'
import { CircuitError } from '../connectome/types'
import type { CircuitGraph } from '../connectome/types'
import { getPreset } from '../presets/presets'
import { MAPPING_VERSION } from '../music/versions'
import type { AppAction, AppState, RestoredSettings } from './state'
import type { Store } from './store'

export interface SessionControllerOptions {
  store: Store<AppState, AppAction>
  createEngine: () => Promise<EngineLike>
  loadGraph: () => Promise<CircuitGraph>
  saveSettings: (settings: RestoredSettings) => void
  randomSeed?: () => number
}

export class SessionController {
  private readonly store: Store<AppState, AppAction>
  private readonly createEngine: () => Promise<EngineLike>
  private readonly loadGraph: () => Promise<CircuitGraph>
  private readonly saveSettings: (settings: RestoredSettings) => void
  private graph: CircuitGraph | null = null
  private engine: EngineLike | null = null
  private startPromise: Promise<void> | null = null
  private unsubscribers: Array<() => void> = []

  constructor(options: SessionControllerOptions) {
    this.store = options.store
    this.createEngine = options.createEngine
    this.loadGraph = options.loadGraph
    this.saveSettings = options.saveSettings
  }

  async loadCircuit(): Promise<void> {
    this.store.dispatch({ type: 'circuitLoading' })
    try {
      const graph = await this.loadGraph()
      this.graph = graph
      this.store.dispatch({ type: 'circuitLoaded', manifest: graph.manifest })
    } catch (error) {
      const circuitError = error instanceof CircuitError ? error : null
      this.store.dispatch({
        type: 'circuitFailed',
        code: circuitError?.code ?? 'unknown',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  startListening(): Promise<void> {
    if (!this.graph) return Promise.resolve()
    if (this.startPromise) return this.startPromise
    const operation = (async () => {
      const engine = await this.createEngine()
      this.engine = engine
      this.unsubscribers = [
        engine.on('status', status => this.store.dispatch({ type: 'engineStatusChanged', status })),
        engine.on('phraseStarted', ({ score }) => this.store.dispatch({ type: 'phraseStarted', score })),
        engine.on('applied', ({ recipe }) => {
          this.store.dispatch({ type: 'changesApplied', recipe })
          this.save()
        }),
        engine.on('position', position => this.store.dispatch({ type: 'positionChanged', position })),
      ]
      const state = this.store.getState()
      await engine.start(this.graph!, state.active, state.mix)
    })()
    this.startPromise = operation
    void operation.finally(() => {
      if (this.startPromise === operation) this.startPromise = null
    }).catch(() => undefined)
    return operation
  }

  togglePlay(): void {
    if (!this.engine) return
    const status = this.store.getState().engineStatus
    if (status === 'starting' || status === 'exporting') return
    if (status === 'playing') this.engine.pause()
    else this.engine.play()
  }

  getDiagnostics(): EngineDiagnostics | null {
    return this.engine?.getDiagnostics() ?? null
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe()
    this.unsubscribers = []
  }

  private save(): void {
    const { active, mix, ui } = this.store.getState()
    this.saveSettings({
      mappingVersion: MAPPING_VERSION,
      presetVersion: getPreset(active.presetId).version,
      presetId: active.presetId,
      sessionSeed: active.sessionSeed,
      tempoBpm: active.tempoBpm,
      variation: active.variation,
      mix,
      animationEnabled: ui.animationEnabled,
    })
  }
}
