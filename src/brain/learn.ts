import type { Rng } from '../music/rng'
import type { PresetId } from '../presets/types'
import { BAR_PARTS, critique, CRITIC_PARTS, type BarPart, type CriticPart, type Critique } from './critic'
import { PLASTICITY_CONFIGURATION, type BrainModel } from './model'
import { headLogits, perform, readoutWidth, softmaxInto, type Decision, type FlyRuntime, type Performance, type PhraseActions } from './perform'
import { headRow, HEADS, positionOf, STEPS_PER_BAR, type HeadName } from './vocabulary'

/** Adam state for the readout; only decoder weights learn, internal anatomy stays fixed. */
export interface Optimizer { m: Float32Array; v: Float32Array; t: number }

export function createOptimizer(size: number): Optimizer {
  return { m: new Float32Array(size), v: new Float32Array(size), t: 0 }
}

export const LEARNING_CONFIGURATION = Object.freeze({
  version: 1,
  schoolRate: 0.002,
  practiceRate: 0.0006,
  /** While listeners hear it, the fly keeps practicing far more gently. */
  listeningRate: 0.00008,
  /** A listener's banana counts as this many standard deviations of a good phrase. */
  bananaAdvantage: 1.5,
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-8,
  l2: 1e-5,
  /** Practice keeps a little school in every update so the fly does not forget its vocabulary. */
  practiceAnchor: 0.3,
  entropyBonus: 0.004,
  maxWeight: 8,
})

export function adamStep(weights: Float32Array, gradient: Float32Array, optimizer: Optimizer, rate: number): void {
  const { beta1, beta2, epsilon, l2, maxWeight } = LEARNING_CONFIGURATION
  optimizer.t++
  const correction1 = 1 - beta1 ** optimizer.t
  const correction2 = 1 - beta2 ** optimizer.t
  for (let index = 0; index < weights.length; index++) {
    const g = gradient[index]! + l2 * weights[index]!
    if (g === 0 && optimizer.m[index] === 0) continue
    const m = optimizer.m[index] = beta1 * optimizer.m[index]! + (1 - beta1) * g
    const v = optimizer.v[index] = beta2 * optimizer.v[index]! + (1 - beta2) * g * g
    const next = weights[index]! - rate * (m / correction1) / (Math.sqrt(v / correction2) + epsilon)
    weights[index] = Math.max(-maxWeight, Math.min(maxWeight, next))
  }
  for (const value of weights) if (!Number.isFinite(value)) throw new Error('Non-finite readout weight')
}

export interface HeadStats { count: number; correct: number; loss: number }
export type LessonStats = Partial<Record<HeadName, HeadStats>>

/**
 * Adds `scale * d(-log p(target))/dW` for each recorded decision. With `advantages`, the target is
 * the fly's own choice and the scale is its advantage (policy gradient), plus an entropy bonus.
 */
export function accumulate(
  readout: Float32Array, width: number, performance: Performance, gradient: Float32Array,
  options: { scale?: number; advantage?: (decision: Decision) => number; entropy?: number } = {},
): LessonStats {
  const features = performance.features
  if (!features) throw new Error('Learning requires recorded features')
  const logits = new Float64Array(16)
  const probabilities = new Float64Array(16)
  const stats: LessonStats = {}
  const scale = options.scale ?? 1
  for (const decision of performance.decisions) {
    const count = HEADS[decision.head].length
    const feature = features[decision.step]!
    const position = positionOf(decision.head, decision.step)
    headLogits(readout, width, decision.head, position, feature, logits)
    softmaxInto(logits, count, 1, decision.mask, probabilities)
    let best = 0
    for (let action = 1; action < count; action++) if (probabilities[action]! > probabilities[best]!) best = action
    const head = stats[decision.head] ??= { count: 0, correct: 0, loss: 0 }
    head.count++
    head.correct += Number(best === decision.action)
    head.loss -= Math.log(Math.max(1e-12, probabilities[decision.action]!))
    // Policy gradient ascent on advantage * log p is descent on -advantage * log p.
    const weight = options.advantage ? scale * options.advantage(decision) : scale
    let entropyTerm = 0
    if (options.entropy) {
      for (let action = 0; action < count; action++) {
        const p = probabilities[action]!
        if (p > 0) entropyTerm -= p * Math.log(p)
      }
    }
    for (let action = 0; action < count; action++) {
      if (decision.mask && !decision.mask[action]) continue
      const p = probabilities[action]!
      let coefficient = weight * (p - (action === decision.action ? 1 : 0))
      // d(-H)/dz_a = p_a (log p_a + H); descending on it raises entropy.
      if (options.entropy && p > 0) coefficient += options.entropy * p * (Math.log(p) + entropyTerm)
      if (coefficient === 0) continue
      const row = headRow(decision.head, position, action) * width
      gradient[row] = gradient[row]! + coefficient
      for (let neuron = 0; neuron < feature.length; neuron++) gradient[row + 1 + neuron] = gradient[row + 1 + neuron]! + coefficient * feature[neuron]!
    }
  }
  return stats
}

export function mergeStats(into: LessonStats, from: LessonStats): LessonStats {
  for (const [head, stats] of Object.entries(from) as [HeadName, HeadStats][]) {
    const target = into[head] ??= { count: 0, correct: 0, loss: 0 }
    target.count += stats.count
    target.correct += stats.correct
    target.loss += stats.loss
  }
  return into
}

/** One school lesson: hear a tutor phrase while predicting each choice, then update the readout. */
export function lesson(
  model: BrainModel, readout: Float32Array, optimizer: Optimizer, runtime: FlyRuntime, teacher: PhraseActions, presetId: PresetId, rng: Rng,
  rate: number = LEARNING_CONFIGURATION.schoolRate,
): { runtime: FlyRuntime; stats: LessonStats } {
  const performance = perform(model, readout, runtime, { temperature: 1, rng, teacher, record: true, presetId })
  const gradient = new Float32Array(readout.length)
  const stats = accumulate(readout, readoutWidth(model), performance, gradient, { scale: 1 / Math.max(1, performance.decisions.length / 64) })
  adamStep(readout, gradient, optimizer, rate)
  return { runtime: performance.runtime, stats }
}

/** Which critic part pays for each kind of decision. */
export const HEAD_CREDIT: Readonly<Record<HeadName, CriticPart>> = Object.freeze({
  kick: 'drums', snare: 'drums', hat: 'drums', loopDrums: 'drums',
  bass: 'bass', loopBass: 'bass', chord: 'harmony',
  keys: 'keys', loopKeys: 'keys', lead: 'lead', loopLead: 'lead', section: 'structure',
})

type Tracked = CriticPart | 'total' | `bar:${BarPart}`
const TRACKED: readonly Tracked[] = [...CRITIC_PARTS, 'total', ...BAR_PARTS.map(part => `bar:${part}` as const)]

/** Running reward statistics so advantages stay centered and scaled as the fly improves. */
export interface Baseline { mean: Record<Tracked, number>; variance: Record<Tracked, number>; count: number }

export function createBaseline(): Baseline {
  return {
    mean: Object.fromEntries(TRACKED.map(key => [key, 0.6])) as Baseline['mean'],
    variance: Object.fromEntries(TRACKED.map(key => [key, 0.02])) as Baseline['variance'], count: 0,
  }
}

const normalize = (baseline: Baseline, key: Tracked, value: number) => (value - baseline.mean[key]) / Math.sqrt(baseline.variance[key] + 1e-4)

/** Each choice is credited mostly by the bar it shaped, then by its layer's phrase score and the total. */
export function advantageFor(critic: Critique, baseline: Baseline): (decision: Decision) => number {
  const total = normalize(baseline, 'total', critic.total)
  const parts = Object.fromEntries(CRITIC_PARTS.map(part => [part, normalize(baseline, part, critic[part])])) as Record<CriticPart, number>
  return decision => {
    const part = HEAD_CREDIT[decision.head]
    if (!(BAR_PARTS as readonly string[]).includes(part)) return 0.6 * parts[part] + 0.4 * total
    const barPart = part as BarPart
    const local = normalize(baseline, `bar:${barPart}`, critic.bars[barPart][Math.floor(decision.step / STEPS_PER_BAR)]!)
    return 0.45 * local + 0.35 * parts[part] + 0.2 * total
  }
}

export function updateBaseline(baseline: Baseline, critic: Critique, rate = 0.03): void {
  baseline.count++
  const observe = (key: Tracked, value: number, weight: number) => {
    const delta = value - baseline.mean[key]
    baseline.mean[key] += weight * delta
    baseline.variance[key] = (1 - weight) * (baseline.variance[key] + weight * delta * delta)
  }
  for (const key of [...CRITIC_PARTS, 'total'] as const) observe(key, critic[key], rate)
  for (const part of BAR_PARTS) for (const value of critic.bars[part]) observe(`bar:${part}`, value, rate / 4)
}

export const REPERTOIRE_LIMIT = 30

export interface PracticeResult {
  runtime: FlyRuntime
  performance: Performance
  critic: Critique
}

/**
 * Practice: the fly plays on its own, the critic scores each bar and the phrase, and choices become
 * more likely when they earned more bananas than usual (and less likely when fewer).
 */
export function practiceBatch(
  model: BrainModel, readout: Float32Array, optimizer: Optimizer, baseline: Baseline,
  players: { runtime: FlyRuntime; presetId: PresetId; previous: PhraseActions[] }[], rng: Rng,
  anchor?: { runtime: FlyRuntime; teacher: PhraseActions; presetId: PresetId; weight?: number },
  rate: number = LEARNING_CONFIGURATION.practiceRate,
  repertoire: string[] = [],
): { results: PracticeResult[]; anchorRuntime?: FlyRuntime } {
  const width = readoutWidth(model)
  const gradient = new Float32Array(readout.length)
  const results: PracticeResult[] = []
  const scale = 1 / players.length
  for (const player of players) {
    const performance = perform(model, readout, player.runtime, { temperature: 1, rng, record: true, presetId: player.presetId })
    const critic = critique(performance.actions, player.presetId, player.previous, repertoire)
    if (player.previous.length === 0) {
      repertoire.push(performance.actions.chords.join())
      if (repertoire.length > REPERTOIRE_LIMIT) repertoire.shift()
    }
    accumulate(readout, width, performance, gradient, {
      scale: scale / Math.max(1, performance.decisions.length / 64), advantage: advantageFor(critic, baseline),
      entropy: LEARNING_CONFIGURATION.entropyBonus,
    })
    results.push({ runtime: performance.runtime, performance, critic })
  }
  for (const result of results) updateBaseline(baseline, result.critic)
  let anchorRuntime: FlyRuntime | undefined
  if (anchor) {
    const school = perform(model, readout, anchor.runtime, { temperature: 1, rng, teacher: anchor.teacher, record: true, presetId: anchor.presetId })
    const weight = anchor.weight ?? LEARNING_CONFIGURATION.practiceAnchor
    accumulate(readout, width, school, gradient, { scale: weight / Math.max(1, school.decisions.length / 64) })
    anchorRuntime = school.runtime
  }
  adamStep(readout, gradient, optimizer, rate)
  return { results, anchorRuntime }
}

/**
 * Reward-modulated plasticity inside the circuit (three factors: presynaptic rate, postsynaptic
 * rate, and a dopamine-like advantage). Each plastic synapse's gain moves along
 * advantage * eligibility * sign(weight), scaled so one update moves gains by about `rate` (RMS),
 * and stays within the anatomical bounds.
 */
export function plasticityStep(model: BrainModel, gains: Float32Array, eligibilities: readonly Float32Array[], advantages: readonly number[], rate: number): void {
  if (eligibilities.length !== advantages.length) throw new Error('Each eligibility needs an advantage')
  const direction = new Float64Array(gains.length)
  eligibilities.forEach((eligibility, sample) => {
    const advantage = advantages[sample]!
    for (let index = 0; index < gains.length; index++) direction[index] = direction[index]! + advantage * eligibility[index]!
  })
  let squares = 0
  for (let index = 0; index < gains.length; index++) {
    direction[index] = direction[index]! * Math.sign(model.weight[model.plasticSlots[index]!]!)
    squares += direction[index]! * direction[index]!
  }
  const rms = Math.sqrt(squares / Math.max(1, gains.length))
  if (!(rms > 0)) return
  const { minGain, maxGain } = PLASTICITY_CONFIGURATION
  for (let index = 0; index < gains.length; index++) {
    gains[index] = Math.min(maxGain, Math.max(minGain, gains[index]! + rate * direction[index]! / rms))
  }
}
