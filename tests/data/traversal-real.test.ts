import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { buildGraph } from '../../src/connectome/graph'
import { manifestSchema } from '../../src/connectome/schema'
import { createRng } from '../../src/music/rng'
import { walkPhrase } from '../../src/music/traversal'

const directory = new URL('../../public/data/circuits/mbon-v1/', import.meta.url)
const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')))
const bytes = readFileSync(new URL('circuit.json', directory))
const checksum = createHash('sha256').update(bytes).digest('hex')
const graph = buildGraph(manifest, JSON.parse(bytes.toString('utf8')), checksum)

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
    'start 13768', 'edge 38853', 'edge 531829', 'edge 13728',
    'edge 38853', 'edge 531829', 'edge 13728', 'edge 521526',
  ])
})
