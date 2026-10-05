import { describe, expect, it } from 'vitest'
import { BASS_VOCABULARY, legalBassActions } from '../../../../src/music/learning/context'
import { createDecoderWeights, decodeBassAction, decoderLogits, exploratoryProbabilities, maskedSoftmax } from '../../../../src/music/learning/decoder'
import type { MusicalContext } from '../../../../src/music/learning/types'

const context = (beatInBar = 0, traversalRest = false): MusicalContext => ({
  beat: beatInBar, beatInBar, barParity: 0, chordRingIndex: 0, previousBassAction: null, traversalRest, inputs: [],
})

describe('masked reservoir readout', () => {
  it('uses bias and neuron features in fixed action-major order', () => {
    const weights = createDecoderWeights(2)
    expect(weights).toEqual(Array(27).fill(0))
    weights.splice(3, 3, 0.5, 2, -3)
    expect(decoderLogits(weights, [0.25, -0.5])).toEqual([0, 2.5, 0, 0, 0, 0, 0, 0, 0])
    expect(() => decoderLogits([], [0])).toThrow('dimensions')
    expect(() => decoderLogits([NaN, ...Array(26).fill(0)], [0, 0])).toThrow('Non-finite')
  })

  it('normalizes extreme legal logits stably and gives illegal actions zero mass', () => {
    const mask = legalBassActions(0, false)
    const probabilities = maskedSoftmax([1000, 1001, -1000, 999, Infinity, 0, 0, 0, 0], mask)
    expect(probabilities.every(Number.isFinite)).toBe(true)
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 14)
    expect(probabilities[1]).toBeCloseTo(1 / (1 + Math.exp(-1) + Math.exp(-2)), 14)
    expect(probabilities.slice(4)).toEqual(Array(5).fill(0))
    expect(maskedSoftmax(Array(9).fill(0), Array(9).fill(false))).toEqual(Array(9).fill(0))
    expect(() => maskedSoftmax([Infinity, ...Array(8).fill(0)], mask)).toThrow('Non-finite')
  })

  it('mixes at most 20% legal uniform exploration with decoder probabilities', () => {
    const mask = legalBassActions(0, false)
    const probabilities = [1, ...Array(8).fill(0)]
    expect(exploratoryProbabilities(probabilities, mask, 0)).toEqual(probabilities)
    const full = exploratoryProbabilities(probabilities, mask, 1)
    expect(full[0]).toBeCloseTo(0.85, 14)
    expect(full.slice(1)).toEqual([0.05, 0.05, 0.05, 0, 0, 0, 0, 0])
    expect(exploratoryProbabilities(probabilities, mask, 2)).toEqual(exploratoryProbabilities(probabilities, mask, 1))
    expect(exploratoryProbabilities(probabilities, mask, 0.5)[0]).toBe(0.925)
  })

  it('uses legal vocabulary ties for greedy choice, seeded categorical sampling otherwise, and forced silence', () => {
    const weights = createDecoderWeights(1)
    expect(decodeBassAction(context(), [0], weights, 0, 1, 0)).toMatchObject({ cellId: 'root-hold', probability: 1 })
    expect(decodeBassAction(context(1), [0], weights, 0, 1, 0)).toMatchObject({ cellId: 'rest', probability: 1 })
    // The largest illegal logit cannot win.
    weights[8] = 1e6
    expect(decodeBassAction(context(), [0], weights, 0, 1, 0).cellId).toBe('root-hold')
    weights[8] = 0
    const decisions = Array.from({ length: 200 }, (_, generation) => decodeBassAction(context(), [0], weights, 1, 1, generation))
    expect(new Set(decisions.map(decision => decision.cellId)).size).toBe(4)
    for (let generation = 0; generation < decisions.length; generation++) {
      expect(decodeBassAction(context(), [0], weights, 1, 1, generation)).toEqual(decisions[generation])
      expect(decisions[generation]!.probability).toBe(0.25)
      expect(decisions[generation]!.legalActionMask[BASS_VOCABULARY.indexOf(decisions[generation]!.cellId)]).toBe(true)
    }
    expect(decodeBassAction(context(1, true), [0], weights, 1, 1, 0)).toMatchObject({ cellId: 'rest', probability: 1, forcedRest: true, legalActionMask: Array(9).fill(false) })
  })

  it('makes nonzero readout decisions depend on activity without consulting target sequences', () => {
    const weights = createDecoderWeights(1)
    weights[3] = 1 // root-push neuron weight, with zero bias
    expect(decodeBassAction(context(), [1], weights, 0, 1, 0).cellId).toBe('root-push')
    expect(decodeBassAction(context(), [-1], weights, 0, 1, 0).cellId).toBe('root-hold')
  })
})
