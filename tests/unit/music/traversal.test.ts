import { describe, expect, it } from 'vitest'
import { fixtureGraph } from '../helpers/fixtureGraph'
import { scriptedRng } from '../helpers/scriptedRng'
import { walkPhrase } from '../../../src/music/traversal'

describe('walkPhrase', () => {
  it('chooses a start neuron using the first random value', () => {
    expect(walkPhrase(fixtureGraph(), scriptedRng([0]), 0)[0]).toMatchObject({ kind: 'start', neuronId: '1' })
    expect(walkPhrase(fixtureGraph(), scriptedRng([0.5]), 0)[0]).toMatchObject({ kind: 'start', neuronId: '2' })
  })

  it('weights edges by synapse count at variation zero', () => {
    expect(walkPhrase(fixtureGraph(), scriptedRng([0, 0.5]), 0)[1]).toMatchObject({
      kind: 'edge', neuronId: '2', probability: 81 / 82,
    })
    expect(walkPhrase(fixtureGraph(), scriptedRng([0, 0.99]), 0)[1]).toMatchObject({ kind: 'edge', neuronId: '3' })
  })

  it('lets the graph edge weights affect the chosen transition', () => {
    const changed = fixtureGraph(connections => {
      connections.find(edge => edge.source === '1' && edge.target === '3')!.synapseCount = 9
    })
    expect(walkPhrase(changed, scriptedRng([0, 0.6]), 0)[1]).toMatchObject({ kind: 'edge', neuronId: '3' })
    expect(walkPhrase(fixtureGraph(), scriptedRng([0, 0.6]), 0)[1]).toMatchObject({ kind: 'edge', neuronId: '2' })
  })

  it('uses square-root weighting at variation one', () => {
    expect(walkPhrase(fixtureGraph(), scriptedRng([0, 0.7]), 1)[1]).toMatchObject({ kind: 'edge', neuronId: '2' })
    expect(walkPhrase(fixtureGraph(), scriptedRng([0, 0.8]), 1)[1]).toMatchObject({ kind: 'edge', neuronId: '3' })
  })

  it('rests after a dead end and restarts at the next bar', () => {
    expect(walkPhrase(fixtureGraph(), scriptedRng([0.5, 0.75, 0.1, 0]), 0).slice(0, 5)).toEqual([
      { beat: 0, kind: 'start', neuronId: '2' },
      { beat: 1, kind: 'edge', neuronId: '4', from: '2', synapseCount: 4, probability: 0.5 },
      { beat: 2, kind: 'edge', neuronId: '5', from: '4', synapseCount: 3, probability: 1 },
      { beat: 3, kind: 'rest', neuronId: null },
      { beat: 4, kind: 'restart', neuronId: '1' },
    ])
  })

  it('consumes one random value for the start, each edge, and each restart', () => {
    const rng = scriptedRng([0.5, 0.75, 0.1, 0])
    const steps = walkPhrase(fixtureGraph(), rng, 0)
    expect(rng.floatsConsumed()).toBe(1 + steps.filter(step => step.kind === 'edge' || step.kind === 'restart').length)
  })
})
