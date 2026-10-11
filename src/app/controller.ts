import type { EngineDiagnostics, EngineEventMap, EngineLike } from '../audio/engine'
import { createExportSnapshot, renderPhrase, renderTrack } from '../audio/export'
import type { ExportSnapshot } from '../audio/export'
import { encodeWav16 } from '../audio/wav'
import type { WavData } from '../audio/wav'
import { seedHex } from '../music/streams'
import { CircuitError } from '../connectome/types'
import type { CircuitGraph } from '../connectome/types'
import { getPreset } from '../presets/presets'
import { MAPPING_VERSION } from '../music/versions'
import type { PresetId } from '../presets/types'
import type { PhraseScore } from '../music/types'
import { randomSessionSeed } from './seed'
import type { AppAction, AppState, RestoredSettings } from './state'
import type { MixSettings } from '../audio/rig'
import type { LearningClient, LearningDiagnostics } from './learningClient'
import type { BrainClient, BrainDiagnostics } from './brainClient'
import type { BrainAtlas } from '../brain/protocol'

export const TAPE_PHRASES = 6
export const SONG_PHRASES = 8

export const AUDIO_INTERRUPTED_NOTICE = 'Audio was interrupted by the browser. Press Play to resume.'

export type MixPatch = {
  masterVolume?: number
  ambienceOn?: boolean
  layers?: {
    drums?: Partial<MixSettings['layers']['drums']>
    bass?: Partial<MixSettings['layers']['bass']>
    keys?: Partial<MixSettings['layers']['keys']>
    lead?: Partial<MixSettings['layers']['lead']>
  }
}
import type { Store } from './store'

export type ControllerDiagnostics = EngineDiagnostics & { objectUrlsHeld: number; learning?: LearningDiagnostics; brain?: BrainDiagnostics }

export interface SessionControllerOptions {
  store: Store<AppState, AppAction>
  createEngine: () => Promise<EngineLike>
  loadGraph: () => Promise<CircuitGraph>
  saveSettings: (settings: RestoredSettings) => void
  randomSeed?: () => number
  renderPhrase?: (snapshot: ExportSnapshot) => Promise<WavData>
  renderTrack?: typeof renderTrack
  createObjectUrl?: (blob: Blob) => string
  revokeObjectUrl?: (url: string) => void
  createLearningClient?: (graph: CircuitGraph) => LearningClient
  /** When present, the fly's own brain composes every phrase. */
  createBrainClient?: () => BrainClient
}

export class SessionController {
  private readonly store: Store<AppState, AppAction>
  private readonly createEngine: () => Promise<EngineLike>
  private readonly loadGraph: () => Promise<CircuitGraph>
  private readonly saveSettings: (settings: RestoredSettings) => void
  private readonly randomSeed: () => number
  private readonly renderPhrase: (snapshot: ExportSnapshot) => Promise<WavData>
  private readonly renderTrack: typeof renderTrack
  /** Phrases heard since the last preset or session change, for saving a tape. */
  private tape: PhraseScore[] = []
  private readonly createObjectUrl: (blob: Blob) => string
  private readonly revokeObjectUrl: (url: string) => void
  private readonly createLearningClient?: (graph: CircuitGraph) => LearningClient
  private learning: LearningClient | null = null
  private learningInitialization: Promise<void> | null = null
  private readonly createBrainClient?: () => BrainClient
  private brain: BrainClient | null = null
  private brainInitialization: Promise<void> | null = null
  private recipeChanges = 0
  private circuitGeneration = 0
  private disposed = false
  private readonly heldUrls = new Set<string>()
  private exporting = false
  private graph: CircuitGraph | null = null
  private engine: EngineLike | null = null
  private startPromise: Promise<void> | null = null
  private unsubscribers: Array<() => void> = []
  private readonly stepListeners = new Set<(event: EngineEventMap['step']) => void>()
  private readonly phraseStartedListeners = new Set<(event: { phraseIndex: number }) => void>()

  constructor(options: SessionControllerOptions) {
    this.store = options.store
    this.createEngine = options.createEngine
    this.loadGraph = options.loadGraph
    this.saveSettings = options.saveSettings
    this.randomSeed = options.randomSeed ?? randomSessionSeed
    this.renderPhrase = options.renderPhrase ?? renderPhrase
    this.renderTrack = options.renderTrack ?? renderTrack
    this.createObjectUrl = options.createObjectUrl ?? (blob => URL.createObjectURL(blob))
    this.revokeObjectUrl = options.revokeObjectUrl ?? (url => URL.revokeObjectURL(url))
    this.createLearningClient = options.createLearningClient
    this.createBrainClient = options.createBrainClient
  }

  /** The fly wakes while the connectome downloads; a failure leaves the connectome walk composing. */
  private startBrain(): void {
    if (!this.createBrainClient || this.brain || this.brainInitialization) return
    this.brainInitialization = (async () => {
      const changes = this.recipeChanges
      let brain: BrainClient | null = null
      try {
        brain = this.createBrainClient!()
        this.brain = brain
        await brain.initialize(import.meta.env.BASE_URL, this.store.getState().active)
        if (this.disposed) { brain.dispose(); return }
        if (changes !== this.recipeChanges) brain.reset(this.store.getState().active)
      } catch (error) {
        if (this.disposed) return
        brain?.dispose()
        this.brain = null
        this.store.dispatch({ type: 'brainStatusChanged', brain: {
          status: 'error', message: `The fly brain could not wake up, so the connectome walk is composing. ${error instanceof Error ? error.message : String(error)}`,
          experience: null, playing: null, bananaGiven: null,
        } })
      }
    })()
  }

  private get provider(): BrainClient | LearningClient | null {
    return this.brain ?? this.learning
  }

  async loadCircuit(): Promise<void> {
    const generation = ++this.circuitGeneration
    this.startBrain()
    this.store.dispatch({ type: 'circuitLoading' })
    try {
      const graph = await this.loadGraph()
      if (generation !== this.circuitGeneration || this.disposed) return
      this.graph = graph
      this.store.dispatch({ type: 'circuitLoaded', manifest: graph.manifest })
      if (this.createLearningClient) {
        this.learningInitialization = (async () => {
          const changes = this.recipeChanges
          let learning: LearningClient | null = null
          try {
            this.learning?.dispose()
            learning = this.createLearningClient!(graph)
            this.learning = learning
            const result = await learning.initialize(this.store.getState().active, import.meta.env.BASE_URL)
            if (this.disposed || generation !== this.circuitGeneration) { learning.dispose(); return }
            if (changes !== this.recipeChanges) learning.reset(this.store.getState().active)
            else if (result.restored) this.store.dispatch({ type: 'changesApplied', recipe: result.recipe })
          } catch (error) {
            if (this.disposed || generation !== this.circuitGeneration) return
            this.store.dispatch({ type: 'learningStatusChanged', learning: {
              status: 'error', message: `Learning could not start; the baseline player remains available. ${error instanceof Error ? error.message : String(error)}`,
              checkpoint: '', modelRevision: 0, trainingUpdateCount: 0, generationIndex: 0,
            } })
            learning?.dispose()
            this.learning = null
          }
        })()
      }
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
    if (!this.graph && !this.brain) return Promise.resolve()
    if (this.startPromise) return this.startPromise
    const operation = (async () => {
      const engine = await this.createEngine()
      await this.learningInitialization
      await this.brainInitialization
      if (this.disposed) return
      this.engine = engine
      this.unsubscribers = [
        engine.on('status', status => {
          this.store.dispatch({ type: 'engineStatusChanged', status })
          if (status === 'interrupted') this.store.dispatch({ type: 'audioNoticeChanged', notice: AUDIO_INTERRUPTED_NOTICE })
          else if (status === 'playing') this.store.dispatch({ type: 'audioNoticeChanged', notice: null })
        }),
        engine.on('step', event => {
          for (const handler of Array.from(this.stepListeners)) handler(event)
        }),
        engine.on('phraseStarted', ({ score }) => {
          this.store.dispatch({ type: 'phraseStarted', score })
          const last = this.tape.at(-1)
          if (last && (last.presetId !== score.presetId || last.sessionSeed !== score.sessionSeed)) this.tape = []
          this.tape = [...this.tape, score].slice(-TAPE_PHRASES)
          this.store.dispatch({ type: 'tapeChanged', phrases: this.tape.length })
          for (const handler of Array.from(this.phraseStartedListeners)) handler({ phraseIndex: score.phraseIndex })
          // Radio: after the last phrase of a song begins, queue a new song (a new mood) for the next boundary.
          const state = this.store.getState()
          if (state.radio && score.brain && score.phraseIndex >= SONG_PHRASES - 1 && state.pending.sessionSeed === undefined && state.engineStatus === 'playing') this.newBeat()
        }),
        engine.on('applied', ({ recipe }) => {
          this.store.dispatch({ type: 'changesApplied', recipe })
          this.save()
        }),
        engine.on('position', position => this.store.dispatch({ type: 'positionChanged', position })),
      ]
      const state = this.store.getState()
      if (!this.graph && !this.brain) return
      await engine.start(this.graph, state.active, state.mix, this.provider ?? undefined)
    })()
    this.startPromise = operation
    void operation.finally(() => {
      if (this.startPromise === operation) this.startPromise = null
    }).catch(() => undefined)
    return operation
  }

  onStep(handler: (event: EngineEventMap['step']) => void): () => void {
    this.stepListeners.add(handler)
    return () => this.stepListeners.delete(handler)
  }

  onPhraseStarted(handler: (event: { phraseIndex: number }) => void): () => void {
    this.phraseStartedListeners.add(handler)
    return () => this.phraseStartedListeners.delete(handler)
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

  setAnimationEnabled(enabled: boolean): void {
    this.store.dispatch({ type: 'animationToggled', enabled })
    this.save()
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
        lead: { ...current.layers.lead, ...partial.layers?.lead },
      },
    }
    this.store.dispatch({ type: 'mixChanged', mix: merged })
    this.engine?.setMix(merged)
    this.save()
  }

  setTempo(tempoBpm: number): void {
    this.recipeChanges++
    const playing = this.store.getState().engineStatus === 'playing'
    this.store.dispatch({ type: 'tempoRequested', tempoBpm, immediate: !playing })
    if (playing) this.engine!.request({ kind: 'tempo', tempoBpm })
    else this.engine?.applyTempoNow(tempoBpm)
    this.save()
  }

  setVariation(variation: number): void {
    this.recipeChanges++
    this.store.dispatch({ type: 'variationRequested', variation, immediate: this.engine === null })
    if (this.engine) this.engine.request({ kind: 'variation', variation })
    else this.provider?.update(this.store.getState().active, this.provider.initialPhraseIndex)
    this.save()
  }

  newBeat(): void {
    this.recipeChanges++
    const sessionSeed = this.randomSeed()
    const playing = this.store.getState().engineStatus === 'playing'
    if (playing) {
      this.store.dispatch({ type: 'newBeatRequested', sessionSeed, immediate: false })
      this.engine!.request({ kind: 'newBeat', sessionSeed })
    } else {
      this.store.dispatch({ type: 'newBeatRequested', sessionSeed, immediate: true })
      this.resetListeningRecipe()
    }
    this.save()
  }

  selectPreset(presetId: PresetId): void {
    this.recipeChanges++
    const tempoBpm = getPreset(presetId).tempoBpm
    const playing = this.store.getState().engineStatus === 'playing'
    if (playing) {
      this.store.dispatch({ type: 'presetRequested', presetId, tempoBpm, immediate: false })
      this.engine!.request({ kind: 'preset', presetId, tempoBpm })
    } else {
      this.store.dispatch({ type: 'presetRequested', presetId, tempoBpm, immediate: true })
      this.resetListeningRecipe()
    }
    this.save()
  }

  private resetListeningRecipe(): void {
    const state = this.store.getState()
    const provider = this.provider
    const recipe = provider ? { ...state.active, ...state.pending } : state.active
    if (provider) this.store.dispatch({ type: 'changesApplied', recipe })
    if (this.engine) this.engine.reset(recipe)
    else provider?.reset(recipe)
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

  /** Save the last few phrases that played, back to back, as one WAV. */
  async exportTape(): Promise<void> {
    const engine = this.engine
    const state = this.store.getState()
    const scores = this.tape
    if (!engine || scores.length === 0 || this.exporting) return
    this.exporting = true
    try {
      for (const url of this.heldUrls) this.revokeObjectUrl(url)
      this.heldUrls.clear()
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'preparing', fileName: null, url: null, message: null } })
      engine.beginExport()
      const recipe = { ...state.active, presetId: scores[0]!.presetId, sessionSeed: scores[0]!.sessionSeed }
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'rendering' } })
      const data = await this.renderTrack(scores, recipe, getPreset(recipe.presetId), state.mix)
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'encoding' } })
      const url = this.createObjectUrl(new Blob([encodeWav16(data)], { type: 'audio/wav' }))
      this.heldUrls.add(url)
      this.store.dispatch({ type: 'exportStateChanged', exportState: { status: 'ready', fileName: `lofly-tape-${recipe.presetId}-seed-${seedHex(recipe.sessionSeed)}.wav`, url, message: null } })
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

  getGraph(): CircuitGraph | null {
    return this.graph
  }

  teachMotif(): void { this.learning?.teach() }

  setRadio(enabled: boolean): void { this.store.dispatch({ type: 'radioToggled', enabled }) }

  /** Reward what the fly is playing right now. */
  giveBanana(): void { this.brain?.giveBanana() }
  forgetBrainPractice(): Promise<void> { return this.brain?.forget() ?? Promise.resolve() }
  getBrainAtlas(): BrainAtlas | null { return this.brain?.atlas ?? null }
  getBrainFrames(phraseId: string): Int8Array | null { return this.brain?.framesFor(phraseId) ?? null }
  getBrainExplanations(phraseId: string) { return this.brain?.explanationsFor(phraseId) ?? null }
  cancelTeaching(): void { this.learning?.cancelTeaching() }

  getDiagnostics(): ControllerDiagnostics | null {
    return this.engine ? { ...this.engine.getDiagnostics(), objectUrlsHeld: this.heldUrls.size,
      ...(this.learning ? { learning: this.learning.getDiagnostics() } : {}),
      ...(this.brain ? { brain: this.brain.getDiagnostics() } : {}),
    } : null
  }

  dispose(): void {
    this.disposed = true
    this.circuitGeneration++
    for (const unsubscribe of this.unsubscribers) unsubscribe()
    this.unsubscribers = []
    this.learning?.dispose()
    this.brain?.dispose()
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
