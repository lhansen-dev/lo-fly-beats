import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { layoutCircuit, MAX_OVERVIEW_EDGES } from '../../src/components/scanner/layout'
import { wholeConnectome, wholeManifest } from '../helpers/wholeConnectome'

const graph = wholeConnectome()

it('loads every traced MaleCNS neuron and all retained connections without a class filter', () => {
  expect(graph.neurons.size).toBe(165122)
  expect(graph.manifest.counts).toEqual({ neurons: 165122, cellTypes: 11751, connections: 10510984, synapses: 104213241, deadEnds: 3442 })
  const superclasses = new Set([...graph.neurons.values()].map(neuron => neuron.superclass))
  for (const family of ['ol_intrinsic', 'cb_intrinsic', 'vnc_intrinsic', 'ascending_neuron', 'descending_neuron', 'vnc_motor']) expect(superclasses.has(family)).toBe(true)
  expect([...graph.neurons.values()].filter(neuron => neuron.class === 'MBON')).toHaveLength(97)
  expect([...graph.neurons.values()].some(neuron => neuron.type === null)).toBe(true)
  expect(graph.startNeuronIds).toHaveLength(161680)
  expect(graph.startNeuronIds.every(id => graph.outgoing.get(id)!.length > 0)).toBe(true)
  expect(wholeManifest.output.file).toBe('neurons.json.gzip')
  if (wholeManifest.output.file === 'neurons.json.gzip') {
    expect(graph.checksum).toBe(createHash('sha256').update(`${wholeManifest.output.sha256}:${wholeManifest.output.adjacency.sha256}`).digest('hex'))
  }
})

it('plots every neuron with bounded overview connections and preserves composition inputs', () => {
  const layout = layoutCircuit(graph)
  expect(layout.nodes).toHaveLength(graph.neurons.size)
  expect(new Set(layout.nodes.map(node => node.neuron.id)).size).toBe(graph.neurons.size)
  expect(layout.edges.length).toBeLessThanOrEqual(MAX_OVERVIEW_EDGES)
  expect(layout.edges.length).toBeGreaterThan(500)
  for (const edge of layout.edges) expect(graph.outgoing.get(edge.source)).toContainEqual({ target: edge.target, synapseCount: edge.synapseCount })
  expect(layout.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y) && node.x >= 65 && node.x <= 695 && node.y >= 65 && node.y <= 345)).toBe(true)
  expect(graph.manifest.counts.connections).toBe(10510984)
})
