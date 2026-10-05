import { describe, expect, it } from 'vitest'
import type { CircuitGraph, Neuron } from '../../../../src/connectome/types'
import { buildReservoirGraph } from '../../../../src/music/learning/graph'
import { INPUT_SIZE } from '../../../../src/music/learning/context'
import { createReservoirModel, stepReservoir } from '../../../../src/music/learning/reservoir'
import { mbonGraph, learningModel } from './fixture'

describe('fixed sparse reservoir dynamics', () => {
  it('verifies direction, log-count normalization, zero rows, and simultaneous updates by hand', () => {
    const neurons = new Map<string, Neuron>(['10', '2', '1'].map(id => [id, { id, type: null, instance: null, class: null, superclass: null, somaSide: null }]))
    const graph: CircuitGraph = {
      ...mbonGraph, neurons, outgoing: new Map([
        ['1', [{ target: '2', synapseCount: 3 }, { target: '10', synapseCount: 3 }]],
        ['2', [{ target: '10', synapseCount: 15 }]], ['10', []],
      ]),
    }
    const sparse = buildReservoirGraph(graph)
    expect(sparse.neuronIds).toEqual(['1', '2', '10'])
    expect(sparse.incoming[0]).toEqual([])
    const model = { ...createReservoirModel(sparse), inputWeights: Array(3 * INPUT_SIZE).fill(0) }
    const old = [1, 0, 0]
    const next = stepReservoir(model, old, Array(INPUT_SIZE).fill(0))
    expect(next[0]).toBe(0.75)
    expect(next[1]).toBeCloseTo(0.25 * Math.tanh(0.85), 14)
    // log(4) : log(16) gives weights 0.85/3 : 2*0.85/3 at target 10.
    expect(next[2]).toBeCloseTo(0.25 * Math.tanh(0.85 / 3), 14)
    expect(old).toEqual([1, 0, 0])
    const second = stepReservoir(model, next, Array(INPUT_SIZE).fill(0))
    expect(second[2]).toBeCloseTo(0.75 * next[2]! + 0.25 * Math.tanh(0.85 / 3 * next[0]! + 2 * 0.85 / 3 * next[1]!), 14)
    // Win contributes to the same sum before tanh.
    model.inputWeights[0] = 0.2
    expect(stepReservoir(model, [0, 0, 0], [1, ...Array(INPUT_SIZE - 1).fill(0)])[0]).toBeCloseTo(0.25 * Math.tanh(0.2), 14)
  })

  it('generates repeatable input rows from the fly seed and responds to every feature group', () => {
    const model = learningModel()
    expect(model.inputWeights).toEqual(learningModel().inputWeights)
    expect(model.inputWeights).not.toEqual(learningModel(2).inputWeights)
    expect(model.inputWeights).toHaveLength(97 * 22)
    expect(model.inputWeights.every(weight => weight >= -0.2 && weight <= 0.2)).toBe(true)
    const zero = Array(97).fill(0)
    const baseline = stepReservoir(model, zero, Array(INPUT_SIZE).fill(0))
    expect(baseline).toEqual(zero)
    for (const input of [0, 4, 6, 12, 21]) {
      const features = Array(INPUT_SIZE).fill(0)
      features[input] = 1
      const response = stepReservoir(model, zero, features)
      expect(Math.sqrt(response.reduce((sum, value) => sum + value * value, 0) / response.length)).toBeGreaterThan(0.02)
    }
    expect(zero).toEqual(Array(97).fill(0))
  })

  it('rejects incompatible dimensions, non-finite values, and out-of-bounds activity', () => {
    const model = learningModel()
    const activity = Array(97).fill(0)
    const input = Array(INPUT_SIZE).fill(0)
    expect(() => stepReservoir(model, [], input)).toThrow('dimensions')
    expect(() => stepReservoir(model, activity, [])).toThrow('dimensions')
    expect(() => stepReservoir(model, [...Array(96).fill(0), Infinity], input)).toThrow('Invalid reservoir')
    expect(() => stepReservoir(model, [...Array(96).fill(0), 1.01], input)).toThrow('Invalid reservoir')
    expect(() => stepReservoir(model, activity, [...Array(INPUT_SIZE - 1).fill(0), NaN])).toThrow('Invalid reservoir')
  })
})
