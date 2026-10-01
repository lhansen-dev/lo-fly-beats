import type { EngineDiagnostics, EngineLike } from '../audio/engine'
import type { PendingChange } from '../audio/sequencer'
import { CircuitError } from '../connectome/types'
import type { CircuitGraph } from '../connectome/types'
import { getPreset } from '../presets/presets'
import { MAPPING_VERSION } from '../music/versions'
import type { PresetId } from '../presets/types'
import { randomSessionSeed } from './seed'
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
  private readonly randomSeed: () => number
  private graph: CircuitGraph | null = null
  private engine: EngineLike | null = null
  private startPromise: Promise<void> | null = null
  private unsubscribers: Array<() => void> = []

  constructor(options: SessionControllerOptions) {
    this.store = options.store
    this.createEngine = options.createEngine
    this.loadGraph = options.loadGraph
    this.saveSettings = options.saveSettings
    this.randomSeed = options.randomSeed ?? randomSessionSeed
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

  setTempo(tempoBpm: number): void {
    const playing = this.store.getState().engineStatus === 'playing'
    if (playing) this.engine!.request({ kind: 'tempo', tempoBpm })
    else this.engine?.applyTempoNow(tempoBpm)
    this.store.dispatch({ type: 'tempoRequested', tempoBpm, immediate: !playing })
    this.save()
  }

  setVariation(variation: number): void {
    if (this.engine) this.engine.request({ kind: 'variation', variation })
    this.store.dispatch({ type: 'variationRequested', variation, immediate: this.engine === null })
    this.save()
  }

  newBeat(): void {
    const sessionSeed = this.randomSeed()
    const playing = this.store.getState().engineStatus === 'playing'
    if (playing) {
      this.engine!.request({ kind: 'newBeat', sessionSeed })
      this.store.dispatch({ type: 'newBeatRequested', sessionSeed, immediate: false })
    } else {
      this.store.dispatch({ type: 'newBeatRequested', sessionSeed, immediate: true })
      if (this.engine) this.engine.reset(this.store.getState().active)
    }
    this.save()
  }

  selectPreset(presetId: PresetId): void {
    const tempoBpm = getPreset(presetId).tempoBpm
    const playing = this.store.getState().engineStatus === 'playing'
    if (playing) {
      this.engine!.request({ kind: 'preset', presetId, tempoBpm })
      this.store.dispatch({ type: 'presetRequested', presetId, tempoBpm, immediate: false })
    } else {
      this.store.dispatch({ type: 'presetRequested', presetId, tempoBpm, immediate: true })
      if (this.engine) this.engine.reset(this.store.getState().active)
    }
    this.save()
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
