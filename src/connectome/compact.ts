import { compareIds } from './graph'
import { compactCircuitSchema, manifestSchema } from './schema'
import { CircuitError } from './types'
import type { CircuitGraph, OutEdge } from './types'

export const ADJACENCY_MAGIC = 0x3242464c // LFB2, little endian
const HEADER_WORDS = 5

function requireIntegrity(condition: boolean, message: string): asserts condition {
  if (!condition) throw new CircuitError('integrity', message)
}

// Keep the full graph in typed arrays. Only the outgoing rows actually used by a
// phrase or inspector become objects, with a bounded cache across long sessions.
class CompactOutgoing implements ReadonlyMap<string, readonly OutEdge[]> {
  readonly [Symbol.toStringTag] = 'CompactOutgoing'
  private readonly cache = new Map<string, readonly OutEdge[]>()
  private readonly ids: readonly string[]
  private readonly indices: ReadonlyMap<string, number>
  private readonly offsets: Uint32Array
  private readonly targets: Uint32Array
  private readonly weights: Uint32Array

  constructor(
    ids: readonly string[], indices: ReadonlyMap<string, number>, offsets: Uint32Array,
    targets: Uint32Array, weights: Uint32Array,
  ) {
    this.ids = ids
    this.indices = indices
    this.offsets = offsets
    this.targets = targets
    this.weights = weights
  }

  get size(): number { return this.ids.length }
  has(id: string): boolean { return this.indices.has(id) }
  get(id: string): readonly OutEdge[] | undefined {
    const index = this.indices.get(id)
    if (index === undefined) return undefined
    const cached = this.cache.get(id)
    if (cached) return cached
    const edges: OutEdge[] = []
    for (let edge = this.offsets[index]!; edge < this.offsets[index + 1]!; edge++) {
      edges.push({ target: this.ids[this.targets[edge]!]!, synapseCount: this.weights[edge]! })
    }
    if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value!)
    this.cache.set(id, edges)
    return edges
  }
  *keys(): MapIterator<string> { yield* this.ids }
  *values(): MapIterator<readonly OutEdge[]> {
    for (const id of this.ids) yield this.get(id)!
  }
  *entries(): MapIterator<[string, readonly OutEdge[]]> {
    for (const id of this.ids) yield [id, this.get(id)!]
  }
  [Symbol.iterator](): MapIterator<[string, readonly OutEdge[]]> { return this.entries() }
  forEach(callback: (value: readonly OutEdge[], key: string, map: ReadonlyMap<string, readonly OutEdge[]>) => void, thisArg?: unknown): void {
    for (const id of this.ids) callback.call(thisArg, this.get(id)!, id, this)
  }
}

export function buildCompactGraph(manifestInput: unknown, neuronInput: unknown, adjacency: ArrayBuffer): CircuitGraph {
  const manifestResult = manifestSchema.safeParse(manifestInput)
  const circuitResult = compactCircuitSchema.safeParse(neuronInput)
  if (!manifestResult.success) throw new CircuitError('schema', 'Invalid compact manifest')
  if (!circuitResult.success) throw new CircuitError('schema', 'Invalid neuron annotations')
  const manifest = manifestResult.data
  const circuit = circuitResult.data
  requireIntegrity(manifest.schemaVersion === 2 && manifest.output.file === 'neurons.json.gzip', 'Expected compact circuit manifest')
  requireIntegrity(circuit.circuitId === manifest.circuitId, 'Circuit ID does not match manifest')
  const neuronCount = manifest.counts.neurons
  const edgeCount = manifest.counts.connections
  const expectedBytes = (HEADER_WORDS + neuronCount + 1 + edgeCount * 2) * 4
  requireIntegrity(adjacency.byteLength === expectedBytes && adjacency.byteLength === manifest.output.adjacency.uncompressedBytes, 'Adjacency byte count does not match manifest')
  const header = new DataView(adjacency, 0, HEADER_WORDS * 4)
  requireIntegrity(header.getUint32(0, true) === ADJACENCY_MAGIC && header.getUint32(4, true) === neuronCount && header.getUint32(8, true) === edgeCount && header.getUint32(12, true) === manifest.extraction.minSynapseCount && header.getUint32(16, true) === 0, 'Invalid adjacency header')
  const words = new Uint32Array(adjacency)
  if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1) {
    const view = new DataView(adjacency)
    for (let i = 0; i < words.length; i++) words[i] = view.getUint32(i * 4, true)
  }
  const offsets = words.subarray(HEADER_WORDS, HEADER_WORDS + neuronCount + 1)
  const targets = words.subarray(HEADER_WORDS + neuronCount + 1, HEADER_WORDS + neuronCount + 1 + edgeCount)
  const weights = words.subarray(HEADER_WORDS + neuronCount + 1 + edgeCount)
  requireIntegrity(circuit.neurons.length === neuronCount, 'Neuron count does not match manifest')
  const neurons = new Map(circuit.neurons.map(neuron => [neuron.id, neuron]))
  const ids = circuit.neurons.map(neuron => neuron.id)
  const indices = new Map(ids.map((id, index) => [id, index]))
  requireIntegrity(neurons.size === neuronCount && ids.every((id, index) => index === 0 || compareIds(ids[index - 1]!, id) < 0), 'Duplicate or unsorted neuron IDs')
  requireIntegrity(offsets[0] === 0 && offsets[neuronCount] === edgeCount, 'Invalid adjacency offsets')
  const starts: string[] = []
  let synapses = 0
  for (let source = 0; source < neuronCount; source++) {
    const begin = offsets[source]!, end = offsets[source + 1]!
    requireIntegrity(begin <= end && end <= edgeCount, 'Invalid adjacency row')
    if (end > begin) starts.push(ids[source]!)
    for (let edge = begin; edge < end; edge++) {
      const target = targets[edge]!, weight = weights[edge]!
      requireIntegrity(target < neuronCount && target !== source, 'Invalid adjacency endpoint')
      requireIntegrity(edge === begin || targets[edge - 1]! < target, 'Duplicate or unsorted adjacency targets')
      requireIntegrity(weight >= manifest.extraction.minSynapseCount, 'Synapse count below minimum')
      synapses += weight
    }
  }
  requireIntegrity(synapses === manifest.counts.synapses, 'Synapse total does not match manifest')
  requireIntegrity(neuronCount - starts.length === manifest.counts.deadEnds, 'Dead-end count does not match manifest')
  requireIntegrity(new Set(circuit.neurons.flatMap(neuron => neuron.type === null ? [] : [neuron.type])).size === manifest.counts.cellTypes, 'Cell-type count does not match manifest')
  requireIntegrity(starts.length > 0 && manifest.startNeuronIds.length === 0, 'Compact starts must be derived from every non-dead-end neuron')
  return {
    manifest, checksum: manifest.output.graphSha256,
    neurons, outgoing: new CompactOutgoing(ids, indices, offsets, targets, weights), startNeuronIds: starts,
  }
}
