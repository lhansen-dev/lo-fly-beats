import { wholeConnectome } from '../helpers/wholeConnectome'
import { expect, it } from 'vitest'
import { createRng } from '../../src/music/rng'
import { walkPhrase } from '../../src/music/traversal'

const graph = wholeConnectome()

it('keeps 150 real-graph walks valid at all variation levels', () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const variation of [0, 0.5, 1]) {
      const walk = walkPhrase(graph, createRng(`${seed}|0|1|traversal`), variation)
      expect(walk).toHaveLength(32)
      for (let beat = 0; beat < 32; beat += 4) expect(walk[beat]!.kind).not.toBe('rest')
      for (const step of walk) {
        if (step.kind === 'edge') {
          expect(graph.outgoing.get(step.from)).toContainEqual({ target: step.neuronId, synapseCount: step.synapseCount })
          expect(step.probability).toBeGreaterThan(0)
          expect(step.probability).toBeLessThanOrEqual(1)
        } else if (step.kind === 'start' || step.kind === 'restart') {
          expect(graph.startNeuronIds).toContain(step.neuronId)
        }
      }
    }
  }
})

it('matches the prepared seed 1 traversal sequence', () => {
  const walk = walkPhrase(graph, createRng('1|0|1|traversal'), 0)
  expect(walk.slice(0, 8).map(step => step.kind === 'edge'
    ? `${step.kind} ${step.neuronId}`
    : step.kind === 'rest' ? `${step.kind}` : `${step.kind} ${step.neuronId}`)).toEqual([
    'start 102059', 'edge 12296', 'edge 16298', 'edge 15926',
    'edge 12582', 'edge 523771', 'edge 517268', 'edge 556567',
  ])
})
