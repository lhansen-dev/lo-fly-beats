import { compareIds } from '../../connectome/graph'
import type { CircuitGraph } from '../../connectome/types'
import { RESERVOIR_CONFIGURATION } from './versions'

export interface IncomingModelEdge {
  sourceIndex: number
  /** Unmodified anatomical count, never used as a mutable model weight. */
  synapseCount: number
  weight: number
}

export interface ReservoirGraph {
  checksum: string
  neuronIds: readonly string[]
  /** Target row -> source entries, sorted by stable numeric neuron index. */
  incoming: readonly (readonly Readonly<IncomingModelEdge>[])[]
}

/** Effective positive weights are an engineering model; transmitter signs are unknown. */
export function buildReservoirGraph(graph: CircuitGraph): ReservoirGraph {
  const neuronIds = [...graph.neurons.keys()].sort(compareIds)
  const indices = new Map(neuronIds.map((id, index) => [id, index]))
  const rows: IncomingModelEdge[][] = neuronIds.map(() => [])
  for (const source of neuronIds) {
    for (const edge of graph.outgoing.get(source) ?? []) {
      const targetIndex = indices.get(edge.target)
      if (targetIndex === undefined || !Number.isSafeInteger(edge.synapseCount) || edge.synapseCount <= 0) {
        throw new Error('Invalid reservoir connection')
      }
      rows[targetIndex]!.push({
        sourceIndex: indices.get(source)!, synapseCount: edge.synapseCount, weight: Math.log1p(edge.synapseCount),
      })
    }
  }
  const incoming = rows.map(row => {
    const total = row.reduce((sum, edge) => sum + edge.weight, 0)
    return Object.freeze(row.map(edge => Object.freeze({
      ...edge, weight: edge.weight / total * RESERVOIR_CONFIGURATION.incomingWeightTotal,
    })))
  })
  return Object.freeze({ checksum: graph.checksum, neuronIds: Object.freeze(neuronIds), incoming: Object.freeze(incoming) })
}
