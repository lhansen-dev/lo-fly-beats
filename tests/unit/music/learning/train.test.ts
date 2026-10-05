import { beforeAll, describe, expect, it } from 'vitest'
import { buildPhrasePlan } from '../../../../src/music/compose'
import { BASS_VOCABULARY, legalBassActions } from '../../../../src/music/learning/context'
import { originalContexts, teachingContexts, TEACHING_EXAMPLES, TRAINING_CONFIGURATION } from '../../../../src/music/learning/curriculum'
import { createDecoderWeights } from '../../../../src/music/learning/decoder'
import { connectivityControl, inferReadout, measureMusic } from '../../../../src/music/learning/evaluate'
import { createLearningSnapshot, preparePhrase } from '../../../../src/music/learning/session'
import { acceptTrainingCandidate, createTrainingOperation, measureDecoder, updateDecoder, type TrainingResult } from '../../../../src/music/learning/train'
import type { LearningParameters } from '../../../../src/music/learning/types'
import { PRESETS } from '../../../../src/presets/presets'
import fixtures from '../../../fixtures/learning/contexts.json'
import { fixtureGraph } from '../../helpers/fixtureGraph'
import { learningModel } from './fixture'
import { stepReservoir } from '../../../../src/music/learning/reservoir'

const model = learningModel()
const graph = fixtureGraph()
const makePlans = (seeds: readonly number[]) => Object.values(PRESETS).flatMap(preset => seeds.map(sessionSeed =>
  buildPhrasePlan(graph, { recipeVersion: 1, presetId: preset.id, sessionSeed, variation: 1, tempoBpm: preset.tempoBpm }, 0)))
const training = teachingContexts(makePlans(fixtures.trainingSeeds))
const validation = originalContexts(makePlans(fixtures.validationSeeds))
const initial = createLearningSnapshot(graph.checksum, model)

describe('decoder-only supervised teaching', () => {
  let trained: TrainingResult
  let parameters: LearningParameters
  beforeAll(() => {
    const fixed = structuredClone({ model, initial, training })
    const operation = createTrainingOperation(model, initial.parameters, training, validation)
    while (!operation.advance().done) { /* Verify final outcomes once for this shared fixture. */ }
    trained = operation.result()!
    parameters = acceptTrainingCandidate(initial.parameters, trained)!
    expect({ model, initial, training }).toEqual(fixed)
  }, 30_000)

  it('applies the masked cross-entropy gradient by hand, including L2', () => {
    const weights = createDecoderWeights(1)
    weights[8] = 2 // Illegal weak-action bias receives regularization only.
    const result = updateDecoder(weights, [0.5], legalBassActions(0, false), 0)
    expect(result.loss).toBeCloseTo(Math.log(4), 12)
    expect(weights[0]).toBeCloseTo(0.03 * 0.75, 12)
    expect(weights[1]).toBeCloseTo(0.03 * 0.75 * 0.5, 12)
    expect(weights[2]).toBeCloseTo(-0.03 * 0.25, 12)
    expect(weights[8]).toBeCloseTo(2 - 0.03 * 0.0001 * 2, 12)
    const clipped = updateDecoder(createDecoderWeights(1), [100], legalBassActions(0, false), 0)
    expect(clipped.gradientNorm).toBeGreaterThan(1)
    expect(clipped.clippedNorm).toBeCloseTo(1, 12)
    expect(() => updateDecoder(weights, [0], legalBassActions(0, false), 4)).toThrow('Invalid teaching')
  })

  it('changes only the readout, reduces fresh self-fed validation error, and respects the update budget', () => {
    expect(trained.status).toBe('accepted')
    expect(trained.updates).toBe(20_000)
    expect(trained.teacherUpdates).toBe(4_000)
    expect(trained.rolloutUpdates).toBe(16_000)
    expect(trained.after!.crossEntropy).toBeLessThan(trained.before.crossEntropy)
    expect(trained.after!.accuracy).toBeGreaterThanOrEqual(0.8)
    expect(parameters.decoderWeights).not.toEqual(initial.parameters.decoderWeights)
    expect(parameters).toMatchObject({ modelRevision: 1, trainingUpdateCount: 20_000, configuration: initial.parameters.configuration })
    expect(Object.isFrozen(parameters.decoderWeights)).toBe(true)
    expect(parameters.decoderWeights!.every(Number.isFinite)).toBe(true)
  })

  it('retains the original motif over disjoint seeds and all presets with updates frozen', () => {
    const examples = originalContexts(makePlans(fixtures.heldOutSeeds))
    const before = structuredClone(parameters)
    const measurement = measureDecoder(model, parameters.decoderWeights, examples, 'reservoir')
    expect(measurement.accuracy).toBeGreaterThanOrEqual(0.8)
    for (const example of examples) {
      const plan = { ...example.plan, recipe: { ...example.plan.recipe, variation: 0 } }
      const snapshot = { ...initial, parameters }
      const prepared = preparePhrase(plan, snapshot, model)
      const cells = prepared.score.learning!.bassDecisions.map(decision => decision.cellId)
      expect(measureMusic(plan, prepared.score, cells, example.cells).constraintViolations).toBe(0)
      expect(inferReadout(plan, model, parameters.decoderWeights, 'reservoir').score.events).toEqual(prepared.score.events)
      // Legacy bass cells are not labels or rules available to learned inference.
      const changedLegacy = { ...plan, bassCells: plan.bassCells.map(() => 'fifth' as const) }
      expect(preparePhrase(changedLegacy, snapshot, model)).toEqual(prepared)
    }
    expect(parameters).toEqual(before)
    expect(new Set([...fixtures.trainingSeeds, ...fixtures.validationSeeds, ...fixtures.heldOutSeeds]).size)
      .toBe(fixtures.trainingSeeds.length + fixtures.validationSeeds.length + fixtures.heldOutSeeds.length)
  })

  it('produces the same final candidate independently of chunk boundaries and cannot advance after cancellation', () => {
    const first = createTrainingOperation(model, initial.parameters, training, validation, { maxUpdates: 256 })
    const second = createTrainingOperation(model, initial.parameters, training, validation, { maxUpdates: 256 })
    expect(first.advance()).toEqual({ updates: 128, done: false })
    while (!first.advance().done) { /* default chunks */ }
    while (!second.advance(7).done) { /* deliberately different chunk boundaries */ }
    expect(first.result()).toEqual(second.result())
    const cancelled = createTrainingOperation(model, initial.parameters, training, validation)
    cancelled.advance(9)
    expect(cancelled.cancel()).toMatchObject({ status: 'rejected', decoderWeights: null, updates: 9 })
    expect(cancelled.advance()).toEqual({ updates: 9, done: true })
    expect(acceptTrainingCandidate(initial.parameters, cancelled.result()!)).toBeNull()
    expect(() => first.advance(129)).toThrow('chunk size')
    expect(() => createTrainingOperation(model, initial.parameters, training, validation, { maxUpdates: 20_001 })).toThrow('budget')
  })

  it('excludes forced rests from updates/loss and rejects illegal or empty curricula', () => {
    const plan = structuredClone(training[0]!.plan)
    plan.trace = plan.trace.map(step => step.beat === 0 ? step : { kind: 'rest', neuronId: null,
      beat: step.beat, bar: step.bar, beatInBar: step.beatInBar, neuronType: null, uses: [] })
    const examples = originalContexts([plan])
    const operation = createTrainingOperation(model, initial.parameters, examples, examples, { maxUpdates: 3 })
    expect(operation.advance(3)).toEqual({ updates: 3, done: true })
    expect(operation.result()!.before.observations).toBe(1)
    expect(operation.result()!.after!.observations).toBe(1)
    const illegal = [{ ...examples[0]!, cells: Array(8).fill('fifth') }]
    expect(() => createTrainingOperation(model, initial.parameters, illegal, examples)).toThrow('Illegal teaching')
    expect(() => createTrainingOperation(model, initial.parameters, [], examples)).toThrow('context examples')
    const silent = structuredClone(plan)
    silent.trace[0] = { ...silent.trace[1]!, beat: 0, beatInBar: 0 }
    expect(() => createTrainingOperation(model, initial.parameters, originalContexts([silent]), examples)).toThrow('no eligible')
  })

  it('rejects failed/non-finite and stale candidates without altering the live fly', () => {
    const before = structuredClone(initial)
    const broken = { ...model, inputWeights: [...model.inputWeights] }
    const operation = createTrainingOperation(broken, initial.parameters, training, validation)
    broken.inputWeights[0] = NaN
    expect(operation.advance().done).toBe(true)
    expect(operation.result()).toMatchObject({ status: 'rejected', decoderWeights: null })
    expect(acceptTrainingCandidate(initial.parameters, operation.result()!)).toBeNull()
    expect(acceptTrainingCandidate(parameters, trained)).toBeNull()
    expect(acceptTrainingCandidate(initial.parameters, { ...trained, graphChecksum: 'another-graph' })).toBeNull()
    expect(acceptTrainingCandidate(initial.parameters, { ...trained, decoderWeights: Array(882).fill(Infinity) })).toBeNull()
    expect(acceptTrainingCandidate(initial.parameters, { ...trained, updates: -1 })).toBeNull()
    expect(acceptTrainingCandidate(initial.parameters, { ...trained, after: { observations: 1, crossEntropy: NaN, accuracy: 1 } })).toBeNull()
    expect(initial).toEqual(before)
  })
})

it('keeps curriculum data immutable and every substitution legal at its authored beat', () => {
  expect(TEACHING_EXAMPLES[0]!.cells).toEqual(['root-hold', 'and-root', 'root-push', 'fifth', 'root-short', 'rest', 'root-octave', 'approach'])
  for (const example of TEACHING_EXAMPLES) {
    expect(Object.isFrozen(example.cells)).toBe(true)
    expect(example.provenance.length).toBeGreaterThan(20)
    example.cells.forEach((cell, beat) => expect(legalBassActions(beat % 4, false)[BASS_VOCABULARY.indexOf(cell)]).toBe(true))
  }
  expect(TRAINING_CONFIGURATION).toMatchObject({ learningRate: 0.03, l2: 0.0001, gradientNormCap: 1, maxUpdates: 20_000 })
})

it('alters sources only for the topology control and preserves leak/input weights for both controls', () => {
  const before = structuredClone(model)
  const permuted = connectivityControl(model, 'source-permuted')
  const zero = connectivityControl(model, 'zero')
  expect(new Set(permuted.sourcePermutation).size).toBe(model.graph.neuronIds.length)
  expect(permuted.model.inputWeights).toBe(model.inputWeights)
  expect(zero.model.inputWeights).toBe(model.inputWeights)
  expect(permuted.model.graph.neuronIds).toBe(model.graph.neuronIds)
  let altered = 0
  model.graph.incoming.forEach((row, target) => row.forEach((edge, index) => {
    const control = permuted.model.graph.incoming[target]![index]!
    expect(control).toEqual({ ...edge, sourceIndex: permuted.sourcePermutation[edge.sourceIndex] })
    expect(zero.model.graph.incoming[target]![index]).toEqual({ ...edge, weight: 0 })
    altered += Number(control.sourceIndex !== edge.sourceIndex)
  }))
  expect(altered).toBeGreaterThan(900)
  expect(permuted.model.graph.incoming.map(row => row.length)).toEqual(model.graph.incoming.map(row => row.length))
  expect(connectivityControl(model, 'source-permuted')).toEqual(permuted)
  expect(stepReservoir(zero.model, model.graph.neuronIds.map(() => 0.5), Array(22).fill(0)))
    .toEqual(model.graph.neuronIds.map(() => 0.375))
  expect(model).toEqual(before)
})
