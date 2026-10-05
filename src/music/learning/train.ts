import { advanceContext, BASS_VOCABULARY, INPUT_SIZE, legalBassActions, musicalContext } from './context'
import { TRAINING_CONFIGURATION, type TeachingContext } from './curriculum'
import { decodeBassAction, decoderLogits, maskedSoftmax, readoutFeatures, type ReadoutFeatures } from './decoder'
import type { ReservoirModel } from './reservoir'
import type { LearningParameters, LearningRuntime } from './types'
import { assertLearningParameters, freshRuntime } from './session'

export interface DecoderMeasurement {
  observations: number
  crossEntropy: number
  accuracy: number
}

export interface TrainingResult {
  status: 'accepted' | 'rejected'
  reason: string | null
  features: ReadoutFeatures
  graphChecksum: string
  modelSeed: number
  parentModelRevision: number
  updates: number
  teacherUpdates: number
  rolloutUpdates: number
  decoderWeights: readonly number[] | null
  before: DecoderMeasurement
  after: DecoderMeasurement | null
  configuration: typeof TRAINING_CONFIGURATION
}

export function freshTrainingRuntime(model: ReservoirModel, generationIndex = 0): LearningRuntime {
  return freshRuntime(model.graph.neuronIds.length, generationIndex)
}

/** Cross-entropy plus L2 over output weights only; mutates a privately owned candidate. */
export function updateDecoder(
  weights: number[], features: readonly number[], mask: readonly boolean[], target: number,
): { loss: number; gradientNorm: number; clippedNorm: number } {
  if (!mask[target] || features.some(value => !Number.isFinite(value))) throw new Error('Invalid teaching observation')
  const probabilities = maskedSoftmax(decoderLogits(weights, features), mask)
  const width = features.length + 1
  const gradient = weights.map((weight, index) => {
    const action = Math.floor(index / width)
    const feature = index % width
    return (probabilities[action]! - (action === target ? 1 : 0)) * (feature === 0 ? 1 : features[feature - 1]!)
      + TRAINING_CONFIGURATION.l2 * weight
  })
  const gradientNorm = Math.hypot(...gradient)
  if (!Number.isFinite(gradientNorm)) throw new Error('Non-finite teaching gradient')
  const scale = Math.min(1, TRAINING_CONFIGURATION.gradientNormCap / gradientNorm)
  for (let index = 0; index < weights.length; index++) weights[index] = weights[index]! - TRAINING_CONFIGURATION.learningRate * scale * gradient[index]!
  return { loss: -Math.log(Math.max(Number.MIN_VALUE, probabilities[target]!)), gradientNorm, clippedNorm: gradientNorm * scale }
}

function validateExamples(examples: readonly TeachingContext[]): void {
  if (!examples.length) throw new Error('Teaching requires context examples')
  for (const example of examples) {
    if (!example.plan.trace.length || !example.plan.trace.some(step => step.kind !== 'rest')) throw new Error('Teaching context has no eligible observations')
    if (example.cells.length !== 8) throw new Error('Expected two-bar teaching sequence')
    for (const step of example.plan.trace) {
      if (step.kind !== 'rest' && !legalBassActions(step.beatInBar, false)[BASS_VOCABULARY.indexOf(example.cells[step.beat % 8]!)]) {
        throw new Error(`Illegal teaching action in ${example.id} at beat ${step.beat}`)
      }
    }
  }
}

/** Fresh, self-fed, greedy evaluation; labels are used only to score predictions. */
export function measureDecoder(model: ReservoirModel, weights: readonly number[], examples: readonly TeachingContext[], kind: ReadoutFeatures): DecoderMeasurement {
  let observations = 0
  let loss = 0
  let correct = 0
  for (const example of examples) {
    let runtime = freshTrainingRuntime(model)
    for (let beat = 0; beat < example.plan.trace.length; beat++) {
      const context = musicalContext(example.plan, beat, runtime)
      const { activations, features } = readoutFeatures(model, runtime, context, kind)
      const decision = decodeBassAction(context, features, weights, 0, model.modelSeed, 0)
      if (!decision.forcedRest) {
        const target = example.cells[beat % 8]!
        const probabilities = maskedSoftmax(decoderLogits(weights, features), decision.legalActionMask)
        loss -= Math.log(Math.max(Number.MIN_VALUE, probabilities[BASS_VOCABULARY.indexOf(target)]!))
        correct += Number(decision.cellId === target)
        observations++
      }
      runtime = advanceContext({ ...runtime, activations }, decision)
    }
  }
  return { observations, crossEntropy: observations ? loss / observations : 0, accuracy: observations ? correct / observations : 0 }
}

/** Owns a copy of the readout and a separate runtime. Each advance is bounded and cancellable. */
export function createTrainingOperation(
  model: ReservoirModel, parent: LearningParameters, examples: readonly TeachingContext[], validation: readonly TeachingContext[],
  options: { features?: ReadoutFeatures; maxUpdates?: number } = {},
) {
  validateExamples(examples)
  validateExamples(validation)
  const kind = options.features ?? 'reservoir'
  const maxUpdates = options.maxUpdates ?? TRAINING_CONFIGURATION.maxUpdates
  if (!Number.isSafeInteger(maxUpdates) || maxUpdates < 1 || maxUpdates > TRAINING_CONFIGURATION.maxUpdates) throw new Error('Invalid teaching update budget')
  assertLearningParameters(parent, model)
  const width = (kind === 'reservoir' ? model.graph.neuronIds.length : INPUT_SIZE) + 1
  const weights = kind === 'reservoir' ? [...parent.decoderWeights] : Array<number>(BASS_VOCABULARY.length * width).fill(0)
  if (weights.length !== BASS_VOCABULARY.length * width || weights.some(value => !Number.isFinite(value))) throw new Error('Invalid initial decoder')
  const before = measureDecoder(model, weights, validation, kind)
  let runtime = freshTrainingRuntime(model)
  let exampleIndex = 0
  let beat = 0
  let updates = 0
  let teacherUpdates = 0
  let result: TrainingResult | null = null
  const finish = (reason: string | null) => {
    if (weights.some(value => !Number.isFinite(value))) reason = 'Non-finite candidate weights'
    const after = reason ? null : measureDecoder(model, weights, validation, kind)
    if (after && (!Number.isFinite(after.crossEntropy) || after.observations === 0)) reason = 'Invalid candidate measurement'
    result = Object.freeze({ status: reason ? 'rejected' : 'accepted', reason, features: kind,
      graphChecksum: model.graph.checksum, modelSeed: model.modelSeed, parentModelRevision: parent.modelRevision,
      updates, teacherUpdates, rolloutUpdates: updates - teacherUpdates,
      decoderWeights: reason ? null : Object.freeze([...weights]), before, after, configuration: TRAINING_CONFIGURATION })
    return result
  }
  return {
    advance(chunkUpdates: number = TRAINING_CONFIGURATION.chunkUpdates): { updates: number; done: boolean } {
      if (!Number.isSafeInteger(chunkUpdates) || chunkUpdates < 1 || chunkUpdates > TRAINING_CONFIGURATION.chunkUpdates) throw new Error('Invalid teaching chunk size')
      if (result) return { updates, done: true }
      const end = Math.min(maxUpdates, updates + chunkUpdates)
      // A second bound guarantees yielding even when most traversal beats force silence.
      let visited = 0
      try {
        while (updates < end && visited++ < chunkUpdates * 32) {
          const example = examples[exampleIndex % examples.length]!
          const context = musicalContext(example.plan, beat, runtime)
          const { activations, features } = readoutFeatures(model, runtime, context, kind)
          const teacher = updates < TRAINING_CONFIGURATION.teacherForcingUpdates
          const decision = decodeBassAction(context, features, weights,
            teacher ? 0 : TRAINING_CONFIGURATION.rolloutVariation, model.modelSeed, runtime.generationIndex)
          if (!decision.forcedRest) {
            const target = example.cells[beat % 8]!
            updateDecoder(weights, features, decision.legalActionMask, BASS_VOCABULARY.indexOf(target))
            updates++
            if (teacher) { teacherUpdates++; decision.cellId = target }
          }
          runtime = advanceContext({ ...runtime, activations }, decision)
          if (++beat === example.plan.trace.length) {
            beat = 0
            exampleIndex++
            // Alternate retained sequences and fresh starts to match both listening and reload contexts.
            runtime = exampleIndex % 4 === 0 ? freshTrainingRuntime(model, exampleIndex) : { ...runtime, generationIndex: exampleIndex }
          }
        }
        if (updates === maxUpdates) finish(null)
      } catch (error) { finish(error instanceof Error ? error.message : String(error)) }
      return { updates, done: result !== null }
    },
    cancel(): TrainingResult { return result ?? finish('Teaching cancelled') },
    result(): TrainingResult | null { return result },
  }
}

/** Produces parameters for boundary adoption; never replaces the caller's live snapshot. */
export function acceptTrainingCandidate(parent: LearningParameters, candidate: TrainingResult): LearningParameters | null {
  if (candidate.status !== 'accepted' || candidate.features !== 'reservoir' || !candidate.decoderWeights
    || candidate.parentModelRevision !== parent.modelRevision || candidate.graphChecksum !== parent.graphChecksum
    || candidate.modelSeed !== parent.modelSeed || candidate.decoderWeights.length !== parent.decoderWeights.length
    || !Number.isSafeInteger(candidate.updates) || candidate.updates < 1 || candidate.updates > TRAINING_CONFIGURATION.maxUpdates
    || !candidate.after || candidate.after.observations < 1 || !Number.isFinite(candidate.after.crossEntropy)
    || candidate.after.crossEntropy < 0 || !Number.isFinite(candidate.after.accuracy) || candidate.after.accuracy < 0 || candidate.after.accuracy > 1
    || Object.entries(TRAINING_CONFIGURATION).some(([key, value]) => candidate.configuration[key as keyof typeof TRAINING_CONFIGURATION] !== value)
    || candidate.decoderWeights.some(value => !Number.isFinite(value))
    || !Number.isSafeInteger(parent.trainingUpdateCount + candidate.updates) || !Number.isSafeInteger(parent.modelRevision + 1)) return null
  return Object.freeze({ ...parent, decoderWeights: Object.freeze([...candidate.decoderWeights]),
    modelRevision: parent.modelRevision + 1, trainingUpdateCount: parent.trainingUpdateCount + candidate.updates })
}
