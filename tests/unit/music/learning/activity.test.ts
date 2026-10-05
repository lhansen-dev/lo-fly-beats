import { cpus } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildPhrasePlan } from '../../../../src/music/compose'
import { musicalContext } from '../../../../src/music/learning/context'
import { decodeBassAction } from '../../../../src/music/learning/decoder'
import { stepReservoir } from '../../../../src/music/learning/reservoir'
import { commitPhrase, createLearningSnapshot, preparePhrase } from '../../../../src/music/learning/session'
import { MOTIF_HISTORY_LIMIT, RECENT_ACTION_LIMIT } from '../../../../src/music/learning/versions'
import { PRESETS } from '../../../../src/presets/presets'
import type { SessionRecipe } from '../../../../src/music/types'
import { fixtureGraph } from '../../helpers/fixtureGraph'
import { learningModel } from './fixture'

const graph = fixtureGraph()
const model = learningModel()
const recipe: SessionRecipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 1, tempoBpm: 72 }
const rmsDifference = (a: readonly number[], b: readonly number[]) =>
  Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]!) ** 2, 0) / a.length)

describe('real MBON activity measurements', () => {
  it('responds measurably to altered musical inputs and carries activity between phrases', () => {
    const initial = createLearningSnapshot(graph.checksum, model)
    const plan = buildPhrasePlan(graph, recipe, 0)
    const first = preparePhrase(plan, initial, model)
    const next = commitPhrase(first, initial, first.requestId)!.nextSnapshot
    const continued = preparePhrase({ ...plan, phraseIndex: 1 }, next, model)
    const reset = preparePhrase({ ...plan, phraseIndex: 1 }, initial, model)
    expect(rmsDifference(continued.endingRuntime.activations, reset.endingRuntime.activations)).toBeGreaterThan(0.001)
    const context = musicalContext(plan, 0, next.runtime)
    const baseline = stepReservoir(model, next.runtime.activations, context.inputs)
    const changedInputs: Record<string, number> = {}
    for (const [name, start, size] of [['beat', 0, 4], ['bar', 4, 2], ['chord', 6, 6], ['previousAction', 12, 9]] as const) {
      const altered = [...context.inputs]
      const active = altered.slice(start, start + size).indexOf(1)
      for (let index = start; index < start + size; index++) altered[index] = 0
      altered[start + (active + 1) % size] = 1
      changedInputs[name] = rmsDifference(baseline, stepReservoir(model, next.runtime.activations, altered))
    }
    const restInput = [...context.inputs]
    restInput[21] = 1 - restInput[21]!
    changedInputs.rest = rmsDifference(baseline, stepReservoir(model, next.runtime.activations, restInput))
    for (const difference of Object.values(changedInputs)) expect(difference).toBeGreaterThan(0.01)
    console.info('MBON input sensitivity (RMS activity difference):', JSON.stringify(changedInputs))
  })

  it('stays bounded and responsive over 10,000 phrases without changing weights or growing histories', () => {
    const plans = Object.values(PRESETS).flatMap(preset => Array.from({ length: 20 }, (_, seed) =>
      buildPhrasePlan(graph, { ...recipe, presetId: preset.id, sessionSeed: seed + 1 }, 0)))
    const fixedWeights = structuredClone({ incoming: model.graph.incoming, inputs: model.inputWeights })
    let snapshot = createLearningSnapshot(graph.checksum, model)
    const timings: number[] = []
    let minimum = Infinity
    let maximum = -Infinity
    let saturated = 0
    let samples = 0
    let difference = 0
    const start = performance.now()
    for (let phrase = 0; phrase < 10_000; phrase++) {
      const before = snapshot.runtime.activations
      const started = performance.now()
      const result = preparePhrase({ ...plans[phrase % plans.length]!, phraseIndex: phrase }, snapshot, model)
      timings.push(performance.now() - started)
      const adopted = commitPhrase(result, snapshot, result.requestId)
      if (!adopted) throw new Error(`Failed adoption at phrase ${phrase}`)
      snapshot = adopted.nextSnapshot
      for (const value of snapshot.runtime.activations) {
        if (!Number.isFinite(value) || Math.abs(value) > 1) throw new Error(`Invalid activity at phrase ${phrase}`)
        minimum = Math.min(minimum, value)
        maximum = Math.max(maximum, value)
        if (Math.abs(value) >= 0.95) saturated++
        samples++
      }
      difference += rmsDifference(before, snapshot.runtime.activations)
      if (snapshot.runtime.recentActions.length > RECENT_ACTION_LIMIT || snapshot.recentMotifs.length > MOTIF_HISTORY_LIMIT) {
        throw new Error(`Unbounded history at phrase ${phrase}`)
      }
    }
    expect(snapshot.runtime.generationIndex).toBe(10_000)
    expect(snapshot.runtime.contextBeatIndex).toBe(320_000)
    expect(snapshot.runtime.recentActions).toHaveLength(RECENT_ACTION_LIMIT)
    expect(snapshot.recentMotifs).toHaveLength(MOTIF_HISTORY_LIMIT)
    expect(snapshot.parameters.trainingUpdateCount).toBe(0)
    expect({ incoming: model.graph.incoming, inputs: model.inputWeights }).toEqual(fixedWeights)
    expect(snapshot.parameters.decoderWeights.every(weight => weight === 0)).toBe(true)
    expect(maximum - minimum).toBeGreaterThan(0.1)
    expect(difference / 10_000).toBeGreaterThan(0.01)
    expect(saturated / samples).toBeLessThan(0.01)
    timings.sort((a, b) => a - b)
    const inferenceStart = performance.now()
    for (let beat = 0; beat < 3200; beat++) {
      const context = musicalContext(plans[0]!, beat % 32, snapshot.runtime)
      const activity = stepReservoir(model, snapshot.runtime.activations, context.inputs)
      decodeBassAction(context, activity, snapshot.parameters.decoderWeights, 1, 1, snapshot.runtime.generationIndex)
    }
    console.info('MBON 10,000-phrase measurements:', JSON.stringify({
      cpu: cpus()[0]?.model, node: process.version, phrases: 10_000, beats: 320_000,
      boundaryActivationRange: [minimum, maximum], boundarySaturationRate: saturated / samples,
      meanBoundaryRmsChange: difference / 10_000,
      preparationMeanMs: timings.reduce((sum, value) => sum + value, 0) / timings.length,
      preparationP95Ms: timings[Math.floor(timings.length * 0.95)],
      inferenceMeanMsPerBeat: (performance.now() - inferenceStart) / 3200,
      elapsedMs: performance.now() - start,
    }))
  }, 120_000)
})
