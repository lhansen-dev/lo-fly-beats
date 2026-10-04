import { describe, expect, it } from 'vitest'
import { composePhrase } from '../../../src/music/compose'
import type { TraceStep } from '../../../src/music/types'
import { fixtureGraph } from '../helpers/fixtureGraph'
import { describeTraceStep, formatChance } from '../../../src/components/explanation/describe'

const graph = fixtureGraph()

function step(overrides: Partial<TraceStep> & Pick<TraceStep, 'kind' | 'neuronId'>): TraceStep {
  return {
    beat: 0, bar: 0, beatInBar: 0, neuronType: null, uses: [],
    ...(overrides.kind === 'edge' ? { from: '1', synapseCount: 1, probability: 0.5 } : {}),
    ...overrides,
  } as TraceStep
}

describe('explanation descriptions', () => {
  it('describes connections and authored rules', () => {
    expect(describeTraceStep(step({ kind: 'edge', from: '1', neuronId: '2', synapseCount: 9, probability: 0.9, uses: ['bass root-push'] }), graph)).toEqual({
      label: 'Real connection', title: 'Alpha (1) → Beta (2)', detail: '9 synapses · 90% chance · chose bass root-push',
    })
    expect(describeTraceStep(step({ kind: 'edge', from: '1', neuronId: '3', synapseCount: 1, probability: 0.004 }), graph).detail).toMatch(/^1 synapse · <1% chance/)
    expect(describeTraceStep(step({ kind: 'edge', from: '4', neuronId: '5', synapseCount: 2, probability: 0.5 }), graph).title).toBe('Delta (4) → Untyped neuron (5)')
    expect(describeTraceStep(step({ kind: 'start', neuronId: '1' }), graph).title).toBe('Phrase start at Alpha (1)')
    expect(describeTraceStep(step({ kind: 'restart', neuronId: '2' }), graph).title).toBe('Restart at Beta (2) after a dead end')
    const rest = describeTraceStep(step({ kind: 'rest', neuronId: null }), graph)
    expect(rest.label).toBe('Authored rule')
    expect(rest.detail).toContain('no outgoing connections')
  })

  it('formats chance without decimals', () => {
    expect(formatChance(0.01)).toBe('1%')
  })

  it('labels composed trace edges as real connections', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const score = composePhrase(graph, { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: seed, variation: 0.5, tempoBpm: 72 }, 0)
      for (const item of score.trace) expect(describeTraceStep(item, graph).label).toBe(item.kind === 'edge' ? 'Real connection' : 'Authored rule')
    }
  })
})
