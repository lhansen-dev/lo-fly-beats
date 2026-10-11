import type { Rng } from '../music/rng'
import type { BrainModel } from './model'
import { stepBrain } from './model'
import type { PresetId } from '../presets/types'
import { isLeadOnset, LEAD_START_DEGREE, resolveLeadDegree } from './melody'
import { INPUT_SIZE, leadPitchSense, senseInputs, SILENCE, type HeardSound } from './senses'
import {
  BARS, CHORD_STEPS, headRow, HEADS, positionOf, LOOP_BACK, LOOP_HEADS, LOOP_LAYER, OUTPUT_SIZE, PHRASE_STEPS,
  STEP_HEADS, STEPS_PER_BAR, type HeadName, type LoopHead, type StepHead,
} from './vocabulary'

/** One bar of chosen step actions per layer, kept so the fly can loop what it played. */
export type BarRecord = Readonly<Record<StepHead, readonly number[]>>

export interface FlyRuntime {
  state: Float32Array
  /** Scale degree the lead last sang; melodies move relative to it. */
  leadDegree: number
  heard: Readonly<HeardSound>
  /** Most recent last. At most HISTORY_BARS bars. */
  history: readonly BarRecord[]
  chordRing: number
  /** Consecutive groove phrases just played; drives the habituation sense. */
  grooveRun: number
}

export const HISTORY_BARS = 8

export interface PhraseActions {
  /** Index into HEADS.section. */
  section: number
  /** Lead degree before the phrase; lead actions are relative moves from it. */
  leadStart: number
  steps: Record<StepHead, number[]>
  chords: number[]
  loops: Record<LoopHead, number[]>
}

export interface Decision {
  step: number
  head: HeadName
  action: number
  probability: number
  /** Legal actions; undefined means every action is legal. */
  mask?: readonly boolean[]
}

export interface Performance {
  actions: PhraseActions
  decisions: Decision[]
  /** Neural state used for each step's decisions, only when recording. */
  features: Float32Array[] | null
  frames: Int8Array | null
  runtime: FlyRuntime
  activity: PhraseActivity
}

/** Recorded neural activity for display: mean |rate| by role and the most active song-side neuron per beat. */
export interface PhraseActivity {
  beatPeaks: number[]
  roleLevels: Record<string, number[]>
}

/**
 * A fresh fly. With a mood, the brain starts from seeded spontaneous activity instead of silence,
 * so different sessions begin in different states of mind.
 */
export function freshRuntime(model: BrainModel, mood?: Rng): FlyRuntime {
  const state = new Float32Array(model.size)
  if (mood) for (let neuron = 0; neuron < model.size; neuron++) state[neuron] = (2 * mood.float() - 1) * MOOD_AMPLITUDE
  return { state, leadDegree: LEAD_START_DEGREE, heard: SILENCE, history: [], chordRing: 0, grooveRun: 0 }
}

export const MOOD_AMPLITUDE = 0.5

export function cloneRuntime(runtime: FlyRuntime): FlyRuntime {
  return { state: runtime.state.slice(), leadDegree: runtime.leadDegree, heard: { ...runtime.heard }, history: runtime.history.map(bar => ({ ...bar })), chordRing: runtime.chordRing, grooveRun: runtime.grooveRun }
}

export function readoutWidth(model: BrainModel): number { return model.readoutNeurons.length + 1 }

export function gatherFeatures(model: BrainModel, state: Float32Array, out: Float32Array): Float32Array {
  const { readoutNeurons, featureMean, featureScale } = model
  for (let index = 0; index < readoutNeurons.length; index++) {
    // Standardized and softly bounded so one runaway neuron cannot dominate a decision.
    const z = (state[readoutNeurons[index]!]! - featureMean[index]!) * featureScale[index]!
    out[index] = z > 4 ? 4 : z < -4 ? -4 : z
  }
  return out
}

export function createReadout(model: BrainModel): Float32Array {
  return new Float32Array(OUTPUT_SIZE * readoutWidth(model))
}

export function headLogits(readout: Float32Array, width: number, head: HeadName, position: number, features: Float32Array, out: Float64Array): void {
  for (let action = 0; action < HEADS[head].length; action++) {
    const row = headRow(head, position, action) * width
    let logit = readout[row]!
    for (let neuron = 0; neuron < features.length; neuron++) logit += readout[row + 1 + neuron]! * features[neuron]!
    out[action] = logit
  }
}

export function softmaxInto(logits: Float64Array, count: number, temperature: number, mask: readonly boolean[] | undefined, out: Float64Array): void {
  let maximum = -Infinity
  for (let action = 0; action < count; action++) if (!mask || mask[action]) maximum = Math.max(maximum, logits[action]! / temperature)
  let total = 0
  for (let action = 0; action < count; action++) {
    const value = !mask || mask[action] ? Math.exp(logits[action]! / temperature - maximum) : 0
    out[action] = value
    total += value
  }
  for (let action = 0; action < count; action++) out[action] = out[action]! / total
}

export interface PerformOptions {
  /** The key the fly is playing in; the lead's moves resolve within its scale. */
  presetId: PresetId
  /** 0 plays greedily; 1 samples the learned distribution. */
  temperature: number
  rng: Rng
  /** Teacher forcing: the fly hears and records the tutor's choices instead of its own. */
  teacher?: PhraseActions
  record?: boolean
  /** Capture every neuron's rate at the end of each beat, as int8 (rate * 127), for display. */
  frames?: boolean
}

function loopMask(head: LoopHead, available: number): boolean[] {
  return HEADS[head].map((_, index) => index === 0 || LOOP_BACK[index]! <= available)
}

/** Pure with respect to its inputs: the runtime passed in is never mutated. */
export function perform(model: BrainModel, readout: Float32Array, start: FlyRuntime, options: PerformOptions): Performance {
  const width = readoutWidth(model)
  if (readout.length !== OUTPUT_SIZE * width) throw new Error('Readout does not match the brain')
  if (!(options.temperature >= 0)) throw new Error('Invalid temperature')
  let state = start.state.slice()
  let next = new Float32Array(model.size)
  const current = new Float32Array(model.readoutNeurons.length)
  const inputs = new Float32Array(INPUT_SIZE)
  const logits = new Float64Array(16)
  const probabilities = new Float64Array(16)
  const history: BarRecord[] = start.history.map(bar => ({ ...bar }))
  let heard: HeardSound = { ...start.heard }
  let chordRing = start.chordRing
  let leadDegree = options.teacher?.leadStart ?? start.leadDegree
  let section = 0
  const habituation = Math.min(1, start.grooveRun / 4)
  const actions: PhraseActions = {
    section: 0,
    leadStart: leadDegree,
    steps: Object.fromEntries(STEP_HEADS.map(head => [head, Array<number>(PHRASE_STEPS).fill(0)])) as Record<StepHead, number[]>,
    chords: [],
    loops: Object.fromEntries(LOOP_HEADS.map(head => [head, [] as number[]])) as Record<LoopHead, number[]>,
  }
  const decisions: Decision[] = []
  const features: Float32Array[] | null = options.record ? [] : null
  const frames = options.frames ? new Int8Array(BARS * 4 * model.size) : null
  const roleOf = model.circuit.neurons.map(neuron => neuron.role)
  const roleLevels: Record<string, number[]> = { ear: [], wing: [], auditory: [], premotor: [], song: [], motor: [] }
  const beatPeaks: number[] = []
  const roleSums: Record<string, number> = {}
  const roleCounts: Record<string, number> = {}
  for (const role of roleOf) roleCounts[role] = (roleCounts[role] ?? 0) + 1
  let leadSounding = false
  let bassSounding = false
  let currentLoop: Record<LoopHead, number> = { loopDrums: 0, loopBass: 0, loopKeys: 0, loopLead: 0 }

  const decide = (head: HeadName, step: number, mask?: readonly boolean[], forced?: number): number => {
    const count = HEADS[head].length
    headLogits(readout, width, head, positionOf(head, step), current, logits)
    let action: number
    let probability = 1
    if (options.temperature === 0 && forced === undefined) {
      action = -1
      for (let candidate = 0; candidate < count; candidate++) {
        if ((!mask || mask[candidate]) && (action < 0 || logits[candidate]! > logits[action]!)) action = candidate
      }
    } else {
      softmaxInto(logits, count, options.temperature || 1, mask, probabilities)
      if (forced !== undefined) action = forced
      else {
        const draw = options.rng.float()
        let cumulative = 0
        action = -1
        for (let candidate = 0; candidate < count; candidate++) {
          if (mask && !mask[candidate]) continue
          action = candidate
          cumulative += probabilities[candidate]!
          if (draw < cumulative) break
        }
      }
      probability = probabilities[action]!
    }
    if (action < 0 || (mask && !mask[action])) throw new Error(`Illegal ${head} action`)
    decisions.push({ step, head, action, probability, mask })
    return action
  }

  for (let step = 0; step < PHRASE_STEPS; step++) {
    const bar = Math.floor(step / STEPS_PER_BAR)
    const stepInBar = step % STEPS_PER_BAR
    heard = { ...heard, chordRing, section, habituation }
    stepBrain(model, state, senseInputs(step, heard, inputs), next)
    ;[state, next] = [next, state]
    gatherFeatures(model, state, current)
    if (features) features.push(current.slice())

    if (step === 0) {
      section = decide('section', step, undefined, options.teacher?.section)
      actions.section = section
    }
    if (step % CHORD_STEPS === 0) {
      chordRing = decide('chord', step, undefined, options.teacher?.chords[step / CHORD_STEPS])
      actions.chords.push(chordRing)
    }
    if (stepInBar === 0) {
      for (const head of LOOP_HEADS) {
        const choice = decide(head, step, loopMask(head, history.length), options.teacher?.loops[head][bar])
        actions.loops[head].push(choice)
        currentLoop = { ...currentLoop, [head]: choice }
      }
    }
    for (const head of LOOP_HEADS) {
      const back = LOOP_BACK[currentLoop[head]]!
      for (const layer of LOOP_LAYER[head]) {
        if (back === 0) {
          actions.steps[layer][step] = decide(layer, step, undefined, options.teacher?.steps[layer][step])
        } else {
          actions.steps[layer][step] = history[history.length - back]![layer][stepInBar]!
        }
      }
    }
    // What the fly hears on the next sixteenth is exactly what it just played.
    const velocity = (head: 'kick' | 'snare' | 'hat') => [0, 0.5, 1][actions.steps[head][step]!]!
    const bassAction = actions.steps.bass[step]!
    const leadAction = actions.steps.lead[step]!
    const keysAction = actions.steps.keys[step]!
    if (bassAction >= 2) bassSounding = true
    else if (bassAction === 1) bassSounding = false
    if (isLeadOnset(leadAction)) {
      leadSounding = true
      leadDegree = resolveLeadDegree(leadDegree, leadAction, options.presetId, chordRing)
    } else if (leadAction === 1) leadSounding = false
    heard = {
      kick: velocity('kick'), snare: velocity('snare'), hat: velocity('hat'),
      bassOnset: bassAction >= 2 ? 1 : 0,
      bassPitch: bassAction >= 2 ? (bassAction - 2) / 5 : bassSounding ? heard.bassPitch : -1,
      keysOnset: keysAction === 1 || keysAction === 2 ? 1 : 0,
      leadOnset: leadAction >= 2 ? 1 : 0,
      leadPitch: leadSounding ? leadPitchSense(leadDegree) : -1,
      chordRing, section, habituation,
    }

    for (let neuron = 0; neuron < model.size; neuron++) {
      const role = roleOf[neuron]!
      roleSums[role] = (roleSums[role] ?? 0) + Math.abs(state[neuron]!)
    }
    if (step % 4 === 3) {
      if (frames) {
        const offset = Math.floor(step / 4) * model.size
        for (let neuron = 0; neuron < model.size; neuron++) frames[offset + neuron] = Math.round(state[neuron]! * 127)
      }
      for (const role of Object.keys(roleLevels)) {
        roleLevels[role]!.push((roleSums[role] ?? 0) / 4 / Math.max(1, roleCounts[role] ?? 0))
        roleSums[role] = 0
      }
      let peak = -1
      for (let neuron = 0; neuron < model.size; neuron++) {
        const role = roleOf[neuron]
        if ((role === 'song' || role === 'motor' || role === 'premotor') && (peak < 0 || Math.abs(state[neuron]!) > Math.abs(state[peak]!))) peak = neuron
      }
      beatPeaks.push(peak)
    }
    if (stepInBar === STEPS_PER_BAR - 1) {
      history.push(Object.fromEntries(STEP_HEADS.map(head => [head, actions.steps[head].slice(bar * STEPS_PER_BAR, (bar + 1) * STEPS_PER_BAR)])) as unknown as BarRecord)
      if (history.length > HISTORY_BARS) history.shift()
    }
  }
  if (actions.chords.length !== BARS / 2) throw new Error('Expected four chord decisions')
  return {
    actions, decisions, features, frames,
    runtime: { state, leadDegree, heard, history, chordRing, grooveRun: section === 0 ? start.grooveRun + 1 : 0 },
    activity: { beatPeaks, roleLevels },
  }
}
