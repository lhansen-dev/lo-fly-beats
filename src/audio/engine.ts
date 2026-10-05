import * as Tone from 'tone'
import type { BaseContext } from 'tone'
import type { CircuitGraph } from '../connectome/types'
import { composePhrase } from '../music/compose'
import type { PhraseScore, SessionRecipe } from '../music/types'
import { getPreset } from '../presets/presets'
import type { MixSettings, InstrumentRig } from './rig'
import { createRig, DEFAULT_MIX } from './rig'
import { PlaybackSequencer } from './sequencer'
import type { PendingChange, PreparedScoreProvider } from './sequencer'
import { eventDurationSeconds, eventOffsetSeconds } from './timing'

export type EngineStatus = 'idle' | 'starting' | 'playing' | 'paused' | 'interrupted' | 'exporting'

export interface EngineDiagnostics {
  contextState: string
  status: EngineStatus
  transportState: string
  sampleRate: number
  repeatEvents: number
  scoresHeld: number
  keysActiveVoices: number
  exportInProgress: boolean
}

export type EngineEventMap = {
  status: EngineStatus
  phraseStarted: { score: PhraseScore; recipe: SessionRecipe }
  applied: { kinds: PendingChange['kind'][]; recipe: SessionRecipe }
  position: { phraseIndex: number; bar: number; beat: number }
  step: { phraseIndex: number; stepInPhrase: number; bar: number; beat: number }
}
export interface EngineLike {
  on<K extends keyof EngineEventMap>(name: K, handler: (payload: EngineEventMap[K]) => void): () => void
  start(graph: CircuitGraph, recipe: SessionRecipe, mix: MixSettings, prepared?: PreparedScoreProvider): Promise<void>
  setMix(mix: MixSettings): void
  play(): void | Promise<void>
  debugInterrupt(): void
  pause(): void
  beginExport(): void
  endExport(): void
  reset(recipe: SessionRecipe): void
  request(change: PendingChange): void
  applyTempoNow(tempoBpm: number): void
  getDiagnostics(): EngineDiagnostics
}

type EventHandler<K extends keyof EngineEventMap> = (payload: EngineEventMap[K]) => void

class PlaybackEngine implements EngineLike {
  private status: EngineStatus = 'idle'
  private context: BaseContext | null = null
  private rig: InstrumentRig | null = null
  private sequencer: PlaybackSequencer | null = null
  private prepared: PreparedScoreProvider | undefined
  private recipe: SessionRecipe | null = null
  private mix: MixSettings = { ...DEFAULT_MIX, layers: { ...DEFAULT_MIX.layers } }
  private repeatEvents = 0
  private startPromise: Promise<void> | null = null
  private exportInProgress = false
  private resumePromise: Promise<void> | null = null
  private resumeGeneration = 0
  private playbackGeneration = 0
  private handlers = new Map<keyof EngineEventMap, Set<(payload: never) => void>>()

  on<K extends keyof EngineEventMap>(name: K, handler: EventHandler<K>): () => void {
    let set = this.handlers.get(name)
    if (!set) { set = new Set(); this.handlers.set(name, set) }
    set.add(handler as (payload: never) => void)
    return () => { set?.delete(handler as (payload: never) => void) }
  }

  private emit<K extends keyof EngineEventMap>(name: K, payload: EngineEventMap[K]): void {
    this.handlers.get(name)?.forEach(handler => handler(payload as never))
  }

  private setStatus(status: EngineStatus): void {
    if (this.status === status) return
    this.status = status
    this.emit('status', status)
  }

  start(graph: CircuitGraph, recipe: SessionRecipe, mix: MixSettings, prepared?: PreparedScoreProvider): Promise<void> {
    if (this.status === 'exporting' || this.status === 'playing' || this.status === 'paused') return Promise.resolve()
    if (this.startPromise) return this.startPromise
    this.mix = mix
    this.setStatus('starting')
    this.startPromise = (async () => {
      await Tone.start()
      let scoreProvider = prepared
      try { await scoreProvider?.ensureReady(recipe, scoreProvider.initialPhraseIndex) }
      catch { scoreProvider = undefined }
      this.prepared = scoreProvider
      const context = Tone.getContext()
      this.context = context
      context.on('statechange', () => this.handleContextStateChange())
      this.recipe = recipe
      const preset = getPreset(recipe.presetId)
      this.rig = createRig(context, preset.sound, this.mix)
      this.rig.setMix(this.mix, context.currentTime)
      this.sequencer = new PlaybackSequencer((r, i) => composePhrase(graph, r, i), recipe, scoreProvider)
      context.transport.bpm.value = recipe.tempoBpm
      context.transport.swing = 0
      if (this.mix.ambienceOn) this.rig.startAmbience(context.currentTime)
      context.transport.scheduleRepeat(time => this.onStep(time), '16n', 0)
      this.repeatEvents = 1
      context.transport.start()
      this.setStatus('playing')
    })()
    return this.startPromise
  }

  private onStep(time: number): void {
    const context = this.context
    const sequencer = this.sequencer
    const rig = this.rig
    const recipe = this.recipe
    if (!context || !sequencer || !rig || !recipe) return
    if (this.status === 'interrupted' || context.state !== 'running') return
    const plan = sequencer.advance()
    if (plan.applied.length > 0) {
      this.recipe = sequencer.active
      this.emit('applied', { kinds: plan.applied, recipe: sequencer.active })
    }
    const activeRecipe = this.recipe
    if (!activeRecipe) return
    const preset = getPreset(activeRecipe.presetId)
    if (plan.tempoChanged) context.transport.bpm.setValueAtTime(plan.tempoBpm, time)
    if (plan.phraseStarted) {
      rig.applySound(preset.sound, time)
      this.emit('phraseStarted', { score: plan.phraseStarted, recipe: activeRecipe })
    }
    for (const event of plan.events) rig.trigger(event, time + eventOffsetSeconds(event, plan.tempoBpm, preset.swing), eventDurationSeconds(event, plan.tempoBpm))
    if (document.hidden) return
    const generation = this.playbackGeneration
    context.draw.schedule(() => {
      if (generation !== this.playbackGeneration || this.status !== 'playing') return
      this.emit('step', { phraseIndex: plan.phraseIndex, stepInPhrase: plan.stepInPhrase, bar: plan.bar, beat: plan.beat })
      if (plan.stepInPhrase % 4 === 0) this.emit('position', { phraseIndex: plan.phraseIndex, bar: plan.bar, beat: plan.beat })
    }, time)
  }

  setMix(mix: MixSettings): void {
    const previousAmbienceOn = this.mix.ambienceOn
    this.mix = mix
    if (!this.context || !this.rig) return
    const now = this.context.currentTime
    this.rig.setMix(mix, now)
    if (this.status === 'playing' && previousAmbienceOn !== mix.ambienceOn) {
      if (mix.ambienceOn) this.rig.startAmbience(now)
      else this.rig.stopAmbience(now)
    }
  }

  pause(): void {
    if (this.status !== 'playing' || !this.context || !this.rig) return
    const now = this.context.currentTime
    this.rig.stopAmbience(now)
    this.rig.rampMasterGain(0, 0.08, now)
    this.context.transport.pause()
    this.rig.releaseAll(now + 0.09)
    this.rig.rampMasterGain(this.mix.masterVolume, 0.03, now + 0.12)
    this.setStatus('paused')
  }

  private handleContextStateChange(): void {
    const context = this.context
    const rig = this.rig
    if (!context || !rig || this.status !== 'playing' || context.state === 'running') return
    const now = context.currentTime
    context.transport.pause(now)
    rig.stopAmbience(now)
    rig.releaseAll(now)
    this.playbackGeneration += 1
    this.setStatus('interrupted')
  }

  private resumeTransport(): void {
    const now = this.context!.currentTime
    this.rig!.setMix(this.mix, now)
    if (this.mix.ambienceOn) this.rig!.startAmbience(now)
    this.context!.transport.start()
    this.setStatus('playing')
  }

  private resumeAfterStart(): Promise<void> {
    if (this.resumePromise) return this.resumePromise
    const generation = this.resumeGeneration
    const fromStatus = this.status
    const operation = (async () => {
      try { await Tone.start() } catch { return }
      if (this.prepared && this.sequencer?.currentScore === null && this.recipe) {
        try { await this.prepared.ensureReady(this.recipe, this.prepared.initialPhraseIndex) }
        catch { this.prepared = undefined; this.sequencer.useBaseline() }
      }
      if (generation !== this.resumeGeneration || this.status !== fromStatus || this.context?.state !== 'running') return
      this.resumeTransport()
    })()
    this.resumePromise = operation
    void operation.then(() => { if (this.resumePromise === operation) this.resumePromise = null })
    return operation
  }

  play(): void | Promise<void> {
    if (!this.context || !this.rig) return
    if (this.status === 'interrupted' || (this.status === 'paused'
      && (this.context.state !== 'running' || (this.prepared && this.sequencer?.currentScore === null)))) return this.resumeAfterStart()
    if (this.status === 'paused') this.resumeTransport()
  }

  debugInterrupt(): void {
    if (this.context) void (this.context.rawContext as unknown as { suspend(): Promise<void> }).suspend().catch(() => undefined)
  }

  beginExport(): void {
    this.resumeGeneration += 1
    if (this.status !== 'playing' && this.status !== 'paused' && this.status !== 'interrupted') return
    if (this.status === 'playing') this.pause()
    this.exportInProgress = true
    this.setStatus('exporting')
  }

  endExport(): void {
    if (!this.exportInProgress) return
    this.exportInProgress = false
    this.setStatus('paused')
  }

  reset(recipe: SessionRecipe): void {
    if (!this.context || !this.sequencer) return
    this.resumeGeneration += 1
    this.context.transport.stop()
    this.sequencer.reset(recipe)
    this.recipe = recipe
    this.context.transport.bpm.value = recipe.tempoBpm
  }

  request(change: PendingChange): void {
    if (!this.sequencer) return
    const before = this.sequencer.active
    this.sequencer.request(change)
    if (this.sequencer.active !== before) {
      this.recipe = this.sequencer.active
      this.emit('applied', { kinds: [change.kind], recipe: this.recipe })
    }
  }

  applyTempoNow(tempoBpm: number): void {
    if (!this.sequencer || !this.context) return
    this.sequencer.applyTempoNow(tempoBpm)
    this.recipe = this.sequencer.active
    this.context.transport.bpm.value = tempoBpm
    this.emit('applied', { kinds: ['tempo'], recipe: this.recipe })
  }

  getDiagnostics(): EngineDiagnostics {
    return {
      contextState: this.context?.state ?? 'closed',
      status: this.status,
      transportState: this.context?.transport.state ?? 'stopped',
      sampleRate: this.context?.sampleRate ?? 0,
      repeatEvents: this.repeatEvents,
      scoresHeld: this.sequencer?.scoresHeld ?? 0,
      keysActiveVoices: this.rig?.keysActiveVoices ?? 0,
      exportInProgress: this.exportInProgress,
    }
  }
}

const engine = new PlaybackEngine()
export function getEngine(): EngineLike { return engine }
