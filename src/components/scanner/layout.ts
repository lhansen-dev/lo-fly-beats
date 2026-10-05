import type { CircuitGraph, Neuron } from '../../connectome/types'
import { fnv1a32 } from '../../music/rng'

export interface ScanNode {
  neuron: Neuron
  x: number
  y: number
  radius: number
}
export interface ScanEdge {
  key: string
  source: string
  target: string
  synapseCount: number
  path: string
}

export const edgeKey = (source: string, target: string): string => `${source}:${target}`
export const MAX_DETAILED_NEURONS = 512
export const MAX_OVERVIEW_EDGES = 1200

export function scanEdge(source: ScanNode, target: ScanNode, synapseCount: number): ScanEdge {
  const dx = target.x - source.x, dy = target.y - source.y
  return {
    key: edgeKey(source.neuron.id, target.neuron.id), source: source.neuron.id, target: target.neuron.id, synapseCount,
    path: `M ${source.x.toFixed(2)} ${source.y.toFixed(2)} Q ${((source.x + target.x) / 2 - dy * 0.12).toFixed(2)} ${((source.y + target.y) / 2 + dx * 0.12).toFixed(2)} ${target.x.toFixed(2)} ${target.y.toFixed(2)}`,
  }
}

// A deterministic layout grouped by soma side. These positions are schematic, not anatomical coordinates.
// It uses a local hash and never consumes any of the composition's random streams.
export function layoutCircuit(graph: CircuitGraph): { nodes: ScanNode[]; edges: ScanEdge[] } {
  const neurons = [...graph.neurons.values()].sort((a, b) => a.id.localeCompare(b.id))
  const nodes = neurons.map(neuron => {
    const hash = fnv1a32(neuron.id)
    const angle = (hash % 1000) / 1000 * Math.PI * 2
    const distance = 0.35 + ((hash >>> 10) % 1000) / 1550
    const center = neuron.somaSide === 'L' ? 255 : neuron.somaSide === 'R' ? 505 : 380
    return { neuron, x: center + Math.cos(angle) * 145 * distance, y: 205 + Math.sin(angle) * 140 * distance, radius: neurons.length > MAX_DETAILED_NEURONS ? 0.65 : 3.3 }
  })
  const byId = new Map(nodes.map(node => [node.neuron.id, node]))
  if (nodes.length > MAX_DETAILED_NEURONS) {
    // Plot every neuron in linear time; only background connections are reduced.
    // Live paths are built separately from the full, unsampled graph.
    const edges: ScanEdge[] = []
    const stride = Math.ceil(nodes.length / MAX_OVERVIEW_EDGES)
    for (let index = 0; index < nodes.length; index += stride) {
      const node = nodes[index]!
      const outgoing = graph.outgoing.get(node.neuron.id) ?? []
      const strongest = outgoing.reduce<(typeof outgoing)[number] | undefined>((best, edge) => !best || edge.synapseCount > best.synapseCount ? edge : best, undefined)
      const target = strongest ? byId.get(strongest.target) : undefined
      if (strongest && target) edges.push(scanEdge(node, target, strongest.synapseCount))
    }
    return { nodes, edges }
  }
  const links = [...graph.outgoing].flatMap(([source, edges]) => edges.map(edge => ({ source, ...edge })))
  for (let iteration = 0; iteration < 160; iteration++) {
    const forces = nodes.map(() => ({ x: 0, y: 0 }))
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!
        const dx = a.x - b.x, dy = a.y - b.y
        const distance = Math.max(16, dx * dx + dy * dy)
        const force = 6 / distance
        forces[i]!.x += dx * force; forces[i]!.y += dy * force
        forces[j]!.x -= dx * force; forces[j]!.y -= dy * force
      }
    }
    // Side grouping gives the scan a stable left/right orientation; repulsion exposes individual cells.
    nodes.forEach((node, i) => {
      const center = node.neuron.somaSide === 'L' ? 255 : node.neuron.somaSide === 'R' ? 505 : 380
      node.x = Math.max(65, Math.min(695, node.x + forces[i]!.x + (center - node.x) * 0.025))
      node.y = Math.max(65, Math.min(345, node.y + forces[i]!.y + (205 - node.y) * 0.04))
    })
  }
  const edges = links.flatMap(link => {
    const source = byId.get(link.source), target = byId.get(link.target)
    if (!source || !target) return []
    return [scanEdge(source, target, link.synapseCount)]
  })
  return { nodes, edges }
}
