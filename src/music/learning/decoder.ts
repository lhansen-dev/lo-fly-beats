import { clamp } from '../math'
import { BASS_VOCABULARY, legalBassActions } from './context'
import { learningRng } from './random'
import type { BassDecision, MusicalContext } from './types'
import { DECODER_CONFIGURATION, RESERVOIR_CONFIGURATION } from './versions'
import { stepReservoir, type ReservoirModel } from './reservoir'
import type { LearningRuntime } from './types'

export type ReadoutFeatures = 'reservoir' | 'context-only'

/** The context control has the same 22 inputs, without recurrent activity. */
export function readoutFeatures(model: ReservoirModel, runtime: LearningRuntime, context: MusicalContext, kind: ReadoutFeatures) {
  const activations = kind === 'reservoir' ? stepReservoir(model, runtime.activations, context.inputs) : runtime.activations
  return { activations, features: kind === 'reservoir' ? activations : context.inputs }
}

export function createDecoderWeights(reservoirSize: number): number[] {
  return Array<number>(BASS_VOCABULARY.length * (reservoirSize + 1)).fill(0)
}

/** Action-major Wout * [1, x]; context reaches the decoder through activity only. */
export function decoderLogits(weights: readonly number[], activations: readonly number[]): number[] {
  const width = activations.length + 1
  if (weights.length !== BASS_VOCABULARY.length * width) throw new Error('Incompatible decoder dimensions')
  return BASS_VOCABULARY.map((_, action) => {
    let logit = weights[action * width]!
    for (let neuron = 0; neuron < activations.length; neuron++) logit += weights[action * width + neuron + 1]! * activations[neuron]!
    if (!Number.isFinite(logit)) throw new Error('Non-finite decoder logit')
    return logit
  })
}

export function maskedSoftmax(logits: readonly number[], mask: readonly boolean[]): number[] {
  if (logits.length !== BASS_VOCABULARY.length || mask.length !== logits.length) throw new Error('Incompatible action dimensions')
  let maximum = -Infinity
  for (let action = 0; action < logits.length; action++) {
    if (mask[action]) {
      if (!Number.isFinite(logits[action])) throw new Error('Non-finite legal logit')
      maximum = Math.max(maximum, logits[action]!)
    }
  }
  if (maximum === -Infinity) return logits.map(() => 0)
  const probabilities = logits.map((logit, action) => mask[action] ? Math.exp(logit - maximum) : 0)
  const total = probabilities.reduce((sum, value) => sum + value, 0)
  return probabilities.map(value => value / total)
}

export function exploratoryProbabilities(probabilities: readonly number[], mask: readonly boolean[], variation: number): number[] {
  const legalCount = mask.filter(Boolean).length
  const exploration = RESERVOIR_CONFIGURATION.maxExploration * clamp(variation, 0, 1)
  return probabilities.map((probability, action) => mask[action]
    ? (1 - exploration) * probability + exploration / legalCount : 0)
}

export function decodeBassAction(
  context: MusicalContext, activations: readonly number[], weights: readonly number[],
  variation: number, modelSeed: number, generationIndex: number,
): BassDecision {
  const legalActionMask = legalBassActions(context.beatInBar, context.traversalRest)
  if (context.traversalRest) return { beat: context.beat, cellId: 'rest', probability: 1, legalActionMask, forcedRest: true }
  if (!Number.isFinite(variation)) throw new Error('Invalid variation')
  const logits = decoderLogits(weights, activations)
  const legal = legalActionMask.flatMap((allowed, action) => allowed ? [action] : [])
  // Strict comparison preserves the first action in vocabulary order on a tie.
  let chosen = legal[0]!
  for (const action of legal) if (logits[action]! > logits[chosen]!) chosen = action
  let probability = 1
  if (variation > 0) {
    const probabilities = exploratoryProbabilities(maskedSoftmax(logits.map(logit => logit / DECODER_CONFIGURATION.samplingTemperature), legalActionMask), legalActionMask, variation)
    const draw = learningRng(modelSeed, generationIndex, `bass-selection|${context.beat}`).float()
    let cumulative = 0
    chosen = legal[legal.length - 1]!
    for (const action of legal) {
      cumulative += probabilities[action]!
      if (draw < cumulative) { chosen = action; break }
    }
    probability = probabilities[chosen]!
  }
  return { beat: context.beat, cellId: BASS_VOCABULARY[chosen]!, probability, legalActionMask, forcedRest: false }
}
