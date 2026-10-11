import { createRng } from '../music/rng'
import type { SessionRecipe } from '../music/types'
import { arrangePhrase } from './arrange'
import { BRAIN_VERSION, checkpointMatches, type BrainCheckpoint } from './checkpoint'
import { bananas, critique } from './critic'
import {
  accumulate, adamStep, advantageFor, createBaseline, createOptimizer, LEARNING_CONFIGURATION, REPERTOIRE_LIMIT,
  updateBaseline, type Baseline, type Optimizer,
} from './learn'
import type { BrainModel } from './model'
import { cloneRuntime, freshRuntime, perform, readoutWidth, type FlyRuntime, type Performance, type PhraseActions } from './perform'
import type { BrainExperience, ComposedPhrase } from './protocol'

/** What a browser keeps of its own fly between visits. */
export interface SavedBrain {
  brainVersion: number
  circuitChecksum: string
  modelSeed: number
  modelVersion: number
  connectivity: BrainModel['connectivity']
  readoutNeurons: number
  outputs: number
  readout: Float32Array
  experience: BrainCheckpoint['experience']
  history: BrainCheckpoint['history']
  trainedAt: string
  savedAt: string
}

export interface BrainStore {
  load(): Promise<SavedBrain | null>
  save(brain: SavedBrain): Promise<void>
  clear(): Promise<void>
}

interface Prepared {
  phrase: ComposedPhrase
  performance: Performance
  presetId: SessionRecipe['presetId']
  ending: FlyRuntime
  sessionKey: string
}

const SAVE_EVERY = 4
const HISTORY_EVERY = 8
const KEEP_PLAYED = 3

/** Sampling temperature from the Variation control: steady at zero, adventurous at one. */
export function temperatureFor(variation: number): number {
  return 0.6 + 0.4 * Math.max(0, Math.min(1, variation))
}

export function sessionKey(recipe: SessionRecipe): string {
  return `${recipe.presetId}|${recipe.sessionSeed}`
}

/**
 * One persistent fly. Composition never changes the fly; only adopting a phrase (because it is
 * actually about to play) advances its neural state, and only played phrases are learned from.
 */
export class FlyMind {
  readonly model: BrainModel
  private readout: Float32Array
  private readonly shipped: { readout: Float32Array; checkpoint: BrainCheckpoint }
  private readonly store: BrainStore | null
  private runtime: FlyRuntime
  private session: string | null = null
  private previous: PhraseActions[] = []
  private readonly repertoire: string[] = []
  private readonly prepared = new Map<string, Prepared>()
  private readonly played: Prepared[] = []
  private optimizer: Optimizer
  private baseline: Baseline
  private experience: BrainCheckpoint['experience']
  private history: BrainCheckpoint['history']
  private source: BrainExperience['source']
  private trainedAt: string
  private savedAt: string | null = null
  private sinceSave = 0
  private counter = 0
  private listeningBananas: number[] = []

  constructor(model: BrainModel, shippedReadout: Float32Array, checkpoint: BrainCheckpoint, store: BrainStore | null = null) {
    if (!checkpointMatches(checkpoint, model)) throw new Error('The shipped brain does not match this circuit')
    this.model = model
    this.shipped = { readout: shippedReadout, checkpoint }
    this.store = store
    this.readout = shippedReadout.slice()
    this.runtime = freshRuntime(model)
    this.optimizer = createOptimizer(this.readout.length)
    this.baseline = createBaseline()
    this.experience = { ...checkpoint.experience }
    this.history = [...checkpoint.history]
    this.source = 'shipped'
    this.trainedAt = checkpoint.trainedAt
  }

  /** Restore this browser's own fly when it is compatible and finite; otherwise keep the shipped one. */
  async restore(): Promise<void> {
    if (!this.store) return
    const saved = await this.store.load()
    if (!saved) return
    const compatible = saved.brainVersion === BRAIN_VERSION && checkpointMatches(saved, this.model)
      && saved.readout.length === this.readout.length && saved.readout.every(Number.isFinite)
      && saved.experience.schoolLessons >= 0 && saved.experience.practicePhrases >= 0
    if (!compatible) return
    this.readout = saved.readout.slice()
    this.experience = { ...saved.experience }
    this.history = [...saved.history].slice(-400)
    this.source = 'saved'
    this.trainedAt = saved.trainedAt
    this.savedAt = saved.savedAt
  }

  state(): BrainExperience {
    return { experience: { ...this.experience }, history: [...this.history], source: this.source, trainedAt: this.trainedAt, savedAt: this.savedAt }
  }

  compose(recipe: SessionRecipe, phraseIndex: number, fresh: boolean): ComposedPhrase {
    const started = performance.now()
    const key = sessionKey(recipe)
    const newSession = fresh || this.session !== key
    // A new beat or preset wakes the same fly in a new mood; what it learned is untouched.
    const start = newSession ? freshRuntime(this.model, createRng(`mood|${recipe.sessionSeed}|${recipe.presetId}`)) : this.runtime
    const rng = createRng(`play|${recipe.sessionSeed}|${recipe.presetId}|${phraseIndex}|${this.experience.listeningPhrases}`)
    const result = perform(this.model, this.readout, cloneRuntime(start), {
      temperature: temperatureFor(recipe.variation), rng, presetId: recipe.presetId, record: true, frames: true,
    })
    const previous = newSession ? [] : this.previous
    const critic = critique(result.actions, recipe.presetId, previous, this.repertoire)
    const id = `${key}|${phraseIndex}|${++this.counter}`
    const score = arrangePhrase(this.model, this.experience.listeningPhrases, recipe, phraseIndex, result.actions, result.activity)
    const phrase: ComposedPhrase = {
      id, score, bananas: bananas(critic), notes: critic.notes,
      parts: { drums: critic.drums, bass: critic.bass, harmony: critic.harmony, keys: critic.keys, lead: critic.lead, structure: critic.structure },
      frames: result.frames!, composeMs: performance.now() - started,
    }
    // Only the latest preparation can still be adopted.
    this.prepared.clear()
    this.prepared.set(id, { phrase, performance: result, presetId: recipe.presetId, ending: result.runtime, sessionKey: newSession ? `${key}|fresh` : key })
    return phrase
  }

  /** The phrase is about to play: commit its neural state, then practice gently on it. */
  adopt(phraseId: string): boolean {
    const prepared = this.prepared.get(phraseId)
    if (!prepared) return false
    this.prepared.clear()
    const key = prepared.sessionKey.replace(/\|fresh$/, '')
    if (prepared.sessionKey.endsWith('|fresh') || this.session !== key) {
      this.previous = []
      this.repertoire.push(prepared.performance.actions.chords.join())
      if (this.repertoire.length > REPERTOIRE_LIMIT) this.repertoire.shift()
    }
    this.session = key
    this.runtime = prepared.ending
    const critic = critique(prepared.performance.actions, prepared.presetId, this.previous, this.repertoire)
    this.previous = [...this.previous, prepared.performance.actions].slice(-4)
    this.played.push(prepared)
    if (this.played.length > KEEP_PLAYED) this.played.shift()
    // Practice: compare with how the fly usually does, and lean toward what went better than usual.
    if (this.baseline.count >= 3) {
      const gradient = new Float32Array(this.readout.length)
      accumulate(this.readout, readoutWidth(this.model), prepared.performance, gradient, {
        scale: 1 / Math.max(1, prepared.performance.decisions.length / 64), advantage: advantageFor(critic, this.baseline),
        entropy: LEARNING_CONFIGURATION.entropyBonus,
      })
      adamStep(this.readout, gradient, this.optimizer, LEARNING_CONFIGURATION.listeningRate)
    }
    updateBaseline(this.baseline, critic, 0.1)
    this.experience.listeningPhrases++
    this.listeningBananas.push(bananas(critic))
    if (this.listeningBananas.length >= HISTORY_EVERY) {
      const mean = this.listeningBananas.reduce((sum, value) => sum + value, 0) / this.listeningBananas.length
      this.history = [...this.history, { stage: 'listening' as const, phrases: this.experience.listeningPhrases, bananas: Math.round(mean * 10) / 10 }].slice(-400)
      this.listeningBananas = []
    }
    if (++this.sinceSave >= SAVE_EVERY) void this.persist()
    return this.baseline.count > 3
  }

  /** A listener liked a phrase they heard: reinforce every choice the fly made in it. */
  banana(phraseId: string): boolean {
    const played = this.played.find(item => item.phrase.id === phraseId)
    if (!played) return false
    const gradient = new Float32Array(this.readout.length)
    accumulate(this.readout, readoutWidth(this.model), played.performance, gradient, {
      scale: 1 / Math.max(1, played.performance.decisions.length / 64), advantage: () => LEARNING_CONFIGURATION.bananaAdvantage,
    })
    adamStep(this.readout, gradient, this.optimizer, LEARNING_CONFIGURATION.listeningRate * 2)
    this.experience.bananasFromListeners++
    void this.persist()
    return true
  }

  /** Forget this browser's practice and return to the fly as it left school and practice. */
  async forget(): Promise<void> {
    this.readout = this.shipped.readout.slice()
    this.experience = { ...this.shipped.checkpoint.experience }
    this.history = [...this.shipped.checkpoint.history]
    this.optimizer = createOptimizer(this.readout.length)
    this.baseline = createBaseline()
    this.prepared.clear()
    this.played.length = 0
    this.session = null
    this.source = 'shipped'
    this.savedAt = null
    await this.store?.clear()
  }

  async persist(): Promise<void> {
    if (!this.store) return
    this.sinceSave = 0
    const savedAt = new Date().toISOString()
    try {
      await this.store.save({
        brainVersion: BRAIN_VERSION, circuitChecksum: this.model.circuit.checksum, modelSeed: this.model.seed,
        modelVersion: this.shipped.checkpoint.modelVersion, connectivity: this.model.connectivity,
        readoutNeurons: this.model.readoutNeurons.length, outputs: this.shipped.checkpoint.outputs,
        readout: this.readout.slice(), experience: { ...this.experience }, history: [...this.history], trainedAt: this.trainedAt, savedAt,
      })
      this.savedAt = savedAt
      if (this.source === 'shipped') this.source = 'saved'
    } catch {
      // Storage is optional; the fly keeps learning in memory.
    }
  }
}
