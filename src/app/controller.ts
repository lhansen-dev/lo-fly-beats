import type { EngineDiagnostics, EngineLike } from '../audio/engine'
import { createExportSnapshot, renderPhrase } from '../audio/export'
import type { ExportSnapshot } from '../audio/export'
import { encodeWav16 } from '../audio/wav'
import type { WavData } from '../audio/wav'
import { seedHex } from '../music/streams'
import { CircuitError } from '../connectome/types'
import type { CircuitGraph } from '../connectome/types'
import { getPreset } from '../presets/presets'
import { MAPPING_VERSION } from '../music/versions'
import type { PresetId } from '../presets/types'
import { randomSessionSeed } from './seed'
import type { AppAction, AppState, RestoredSettings } from './state'
import type { MixSettings } from '../audio/rig'

export const AUDIO_INTERRUPTED_NOTICE = 'Audio was interrupted by the browser. Press Play to resume.'

export type MixPatch = {
  masterVolume?: number
  ambienceOn?: boolean
  layers?: {
    drums?: Partial<MixSettings['layers']['drums']>
    bass?: Partial<MixSettings['layers']['bass']>
    keys?: Partial<MixSettings['layers']['keys']>
  }
}
import type { Store } from './store'

export type ControllerDiagnostics = EngineDiagnostics & { objectUrlsHeld: number }

export interface SessionControllerOptions {
  store: Store<AppState, AppAction>
  createEngine: () => Promise<EngineLike>
  loadGraph: () => Promise<CircuitGraph>
  saveSettings: (settings: RestoredSettings) => void
  randomSeed?: () => number
  renderPhrase?: (snapshot: ExportSnapshot) => Promise<WavData>
  createObjectUrl?: (blob: Blob) => string
  revokeObjectUrl?: (url: string) => void
}

export class SessionController {
  private readonly store: Store<AppState, AppAction>
  private readonly createEngine: () => Promise<EngineLike>
  private readonly loadGraph: () => Promise<CircuitGraph>
  private readonly saveSettings: (settings: RestoredSettings) => void
  private readonly randomSeed: () => number
  private readonly renderPhrase: (snapshot: ExportSnapshot) => Promise<WavData>
  private readonly createObjectUrl: (blob: Blob) => string
  private readonly revokeObjectUrl: (url: string) => void
  private readonly heldUrls = new Set<string>()
  private exporting = false
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
    this.renderPhrase = options.renderPhrase ?? renderPhrase
    this.createObjectUrl = options.createObjectUrl ?? (blob => URL.createObjectURL(blob))
    this.revokeObjectUrl = options.revokeObjectUrl ?? (url => URL.revokeObjectURL(url))
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
        engine.on('status', status => {
          this.store.dispatch({ type: 'engineStatusChanged', status })
          if (status === 'interrupted') this.store.dispatch({ type: 'audioNoticeChanged', notice: AUDIO_INTERRUPTED_NOTICE })
          else if (status === 'playing') this.store.dispatch({ type: 'audioNoticeChanged', notice: null })
        }),
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

  simulateInterruption(): void {
    this.engine?.debugInterrupt()
  }

  togglePlay(): void {
    if (!this.engine) return
    const status = this.store.getState().engineStatus
    if (status === 'starting' || status === 'exporting') return
    if (status === 'playing') this.engine.pause()
    else this.engine.play()
  }

  setMix(partial: MixPatch): void {
    const current = this.store.getState().mix
    const merged: MixSettings = {
      ...current,
      ...partial,
      layers: {
        drums: { ...current.layers.drums, ...partial.layers?.drums },
        bass: { ...current.layers.bass, ...partial.layers?.bass },
        keys: { ...current.layers.keys, ...partial.layers?.keys },
      },
    }
    this.store.dispatch({ type: 'mixChanged', mix: merged })
    this.engine?.setMix(merged)
    this.save()
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

  async exportPhrase(): Promise<void> {
    const engine = this.engine
    const state = this.store.getState()
    if (!engine || !state.activeScore || this.exporting) return
    this.exporting = true
    try {
      for (const url of this.heldUrls) this.revokeObjectUrl(url)
      this.heldUrls.clear()
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'preparing', fileName: null, url: null, message: null } })
      engine.beginExport()
      const snapshot = createExportSnapshot(state.activeScore, state.active, getPreset(state.active.presetId), state.mix)
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'rendering' } })
      const data = await this.renderPhrase(snapshot)
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'encoding' } })
      const buffer = encodeWav16(data)
      const url = this.createObjectUrl(new Blob([buffer], { type: 'audio/wav' }))
      this.heldUrls.add(url)
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'ready', fileName: `lofly-${snapshot.recipe.presetId}-seed-${seedHex(snapshot.recipe.sessionSeed)}.wav`, url, message: null } })
    } catch (error) {
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'error', message: error instanceof Error ? error.message : String(error), url: null, fileName: null } })
    } finally {
      engine.endExport()
      this.exporting = false
    }
  }

  dismissExport(): void {
    if (this.exporting) return
    for (const url of this.heldUrls) this.revokeObjectUrl(url)
    this.heldUrls.clear()
    this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'idle', fileName: null, url: null, message: null } })
  }

  getDiagnostics(): ControllerDiagnostics | null {
    return this.engine ? { ...this.engine.getDiagnostics(), objectUrlsHeld: this.heldUrls.size } : null
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
