import { clamp } from './math'
import type { Rng } from './rng'
import type { CircuitGraph } from '../connectome/types'
import type { WalkStep } from './types'

export function walkPhrase(graph: CircuitGraph, rng: Rng, variation: number): WalkStep[] {
  const alpha = 2 - 1.5 * clamp(variation, 0, 1)
  const steps: WalkStep[] = [
    { beat: 0, kind: 'start', neuronId: rng.pick(graph.startNeuronIds) },
  ]

  for (let beat = 1; beat < 32; beat++) {
    const prev = steps[beat - 1]!
    if (prev.kind === 'rest' || graph.outgoing.get(prev.neuronId)?.length === 0 || !graph.outgoing.has(prev.neuronId)) {
      if (beat % 4 === 0) {
        steps.push({ beat, kind: 'restart', neuronId: rng.pick(graph.startNeuronIds) })
      } else {
        steps.push({ beat, kind: 'rest', neuronId: null })
      }
      continue
    }

    const from = prev.neuronId
    const edges = graph.outgoing.get(from)!
    const weights = edges.map(edge => edge.synapseCount ** alpha)
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    const r = rng.float() * total
    let running = 0
    let index = edges.length - 1
    for (let i = 0; i < weights.length; i++) {
      running += weights[i]!
      if (running > r) {
        index = i
        break
      }
    }
    const edge = edges[index]!
    steps.push({
      beat,
      kind: 'edge',
      neuronId: edge.target,
      from,
      synapseCount: edge.synapseCount,
      probability: weights[index]! / total,
    })
  }
  return steps
}
