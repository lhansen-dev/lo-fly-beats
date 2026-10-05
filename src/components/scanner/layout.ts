import type { CircuitGraph, Neuron } from '../../connectome/types'
import { fnv1a32 } from '../../music/rng'
import { projectLocation } from './anatomy'

export interface ScanNode {
  neuron: Neuron
  x: number
  y: number
  radius: number
  positionKind: 'soma' | 'attachment' | 'unavailable'
}
export interface ScanEdge {
  key: string
  source: string
  target: string
  synapseCount: number
  path: string
  positioned: boolean
}

export const edgeKey = (source: string, target: string): string => `${source}:${target}`
export const MAX_DETAILED_NEURONS = 512
export const MAX_OVERVIEW_EDGES = 1200

export function scanEdge(source: ScanNode, target: ScanNode, synapseCount: number): ScanEdge {
  const dx = target.x - source.x, dy = target.y - source.y
  return {
    key: edgeKey(source.neuron.id, target.neuron.id), source: source.neuron.id, target: target.neuron.id, synapseCount,
    positioned: source.positionKind !== 'unavailable' && target.positionKind !== 'unavailable',
    path: `M ${source.x.toFixed(2)} ${source.y.toFixed(2)} Q ${((source.x + target.x) / 2 - dy * 0.12).toFixed(2)} ${((source.y + target.y) / 2 + dx * 0.12).toFixed(2)} ${target.x.toFixed(2)} ${target.y.toFixed(2)}`,
  }
}

// Project original anatomy without consuming any composition random streams.
export function layoutCircuit(graph: CircuitGraph): { nodes: ScanNode[]; edges: ScanEdge[] } {
  const neurons = [...graph.neurons.values()].sort((a, b) => a.id.localeCompare(b.id))
  const nodes: ScanNode[] = neurons.map(neuron => {
    const location = neuron.anatomy?.somaLocation ?? neuron.anatomy?.tosomaLocation
    // Unlocated neurons stay in a separate labeled strip; never invent anatomical coordinates.
    const hash = fnv1a32(neuron.id)
    const position = location ? projectLocation(location) : { x: 120 + (hash % 10000) / 10000 * 440, y: 633 + ((hash >>> 16) % 100) / 100 * 12 }
    return { neuron, ...position, radius: neurons.length > MAX_DETAILED_NEURONS ? 0.4 : 3.3, positionKind: neuron.anatomy?.somaLocation ? 'soma' : location ? 'attachment' : 'unavailable' }
  })
  const byId = new Map(nodes.map(node => [node.neuron.id, node]))
  if (nodes.length > MAX_DETAILED_NEURONS) {
    // Plot every neuron; only background connections are reduced. Live paths use the full graph.
    const edges: ScanEdge[] = []
    const stride = Math.ceil(nodes.length / MAX_OVERVIEW_EDGES)
    for (let index = 0; index < nodes.length; index += stride) {
      const node = nodes[index]!
      if (node.positionKind === 'unavailable') continue
      const outgoing = graph.outgoing.get(node.neuron.id) ?? []
      const strongest = outgoing.reduce<(typeof outgoing)[number] | undefined>((best, edge) => !best || edge.synapseCount > best.synapseCount ? edge : best, undefined)
      const target = strongest ? byId.get(strongest.target) : undefined
      if (strongest && target && target.positionKind !== 'unavailable') edges.push(scanEdge(node, target, strongest.synapseCount))
    }
    return { nodes, edges }
  }
  const edges = [...graph.outgoing].flatMap(([id, outgoing]) => outgoing.flatMap(link => {
    const source = byId.get(id), target = byId.get(link.target)
    return source && target ? [scanEdge(source, target, link.synapseCount)] : []
  }))
  return { nodes, edges }
}
