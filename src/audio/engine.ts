import * as Tone from 'tone'
import type { BaseContext } from 'tone'
import type { CircuitGraph } from '../connectome/types'
import { composePhrase } from '../music/compose'
import type { PhraseScore, SessionRecipe } from '../music/types'
import { getPreset } from '../presets/presets'
import type { MixSettings, InstrumentRig } from './rig'
import { createRig } from './rig'
import { PlaybackSequencer } from './sequencer'
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

type EngineEventMap = {
  status: EngineStatus
  phraseStarted: { score: PhraseScore; recipe: SessionRecipe }
  applied: { kinds: string[]; recipe: SessionRecipe }
  position: { phraseIndex: number; bar: number; beat: number }
  step: { phraseIndex: number; stepInPhrase: number; bar: number; beat: number }
}
type EventHandler<K extends keyof EngineEventMap> = (payload: EngineEventMap[K]) => void

class PlaybackEngine {
  private status: EngineStatus = 'idle'
  private context: BaseContext | null = null
  private rig: InstrumentRig | null = null
  private sequencer: PlaybackSequencer | null = null
  private recipe: SessionRecipe | null = null
  private mix: MixSettings | null = null
  private repeatEvents = 0
  private startPromise: Promise<void> | null = null
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

  start(graph: CircuitGraph, recipe: SessionRecipe, mix: MixSettings): Promise<void> {
    if (this.status === 'playing' || this.status === 'paused') return Promise.resolve()
    if (this.startPromise) return this.startPromise
    this.setStatus('starting')
    this.startPromise = (async () => {
      await Tone.start()
      const context = Tone.getContext()
      this.context = context
      this.recipe = recipe
      this.mix = mix
      const preset = getPreset(recipe.presetId)
      this.rig = createRig(context, preset.sound, mix)
      this.sequencer = new PlaybackSequencer((r, i) => composePhrase(graph, r, i), recipe)
      context.transport.bpm.value = recipe.tempoBpm
      context.transport.swing = 0
      if (mix.ambienceOn) this.rig.startAmbience(context.currentTime)
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
    const plan = sequencer.advance()
    const preset = getPreset(recipe.presetId)
    if (plan.tempoChanged) context.transport.bpm.setValueAtTime(plan.tempoBpm, time)
    if (plan.phraseStarted) {
      rig.applySound(preset.sound, time)
      this.emit('phraseStarted', { score: plan.phraseStarted, recipe })
    }
    for (const event of plan.events) rig.trigger(event, time + eventOffsetSeconds(event, plan.tempoBpm, preset.swing), eventDurationSeconds(event, plan.tempoBpm))
    if (document.hidden) return
    context.draw.schedule(() => {
      this.emit('step', { phraseIndex: plan.phraseIndex, stepInPhrase: plan.stepInPhrase, bar: plan.bar, beat: plan.beat })
      if (plan.stepInPhrase % 4 === 0) this.emit('position', { phraseIndex: plan.phraseIndex, bar: plan.bar, beat: plan.beat })
    }, time)
  }

  pause(): void {
    if (this.status !== 'playing' || !this.context || !this.rig || !this.mix) return
    const now = this.context.currentTime
    this.rig.rampMasterGain(0, 0.08, now)
    this.context.transport.pause()
    this.rig.releaseAll(now + 0.09)
    this.rig.rampMasterGain(this.mix.masterVolume, 0.03, now + 0.12)
    this.setStatus('paused')
  }

  play(): void {
    if (this.status !== 'paused' || !this.context) return
    this.context.transport.start()
    this.setStatus('playing')
  }

  reset(recipe: SessionRecipe): void {
    if (!this.context || !this.sequencer) return
    this.context.transport.stop()
    this.sequencer.reset(recipe)
    this.recipe = recipe
    this.context.transport.bpm.value = recipe.tempoBpm
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
      exportInProgress: false,
    }
  }
}

const engine = new PlaybackEngine()
export function getEngine(): PlaybackEngine { return engine }
