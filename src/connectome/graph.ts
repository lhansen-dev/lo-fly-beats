import { circuitSchema, manifestSchema } from './schema'
import { CircuitError } from './types'
import type { CircuitGraph, Connection, Neuron, OutEdge } from './types'

export function compareIds(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)
}

function requireIntegrity(condition: boolean, message: string): asserts condition {
  if (!condition) throw new CircuitError('integrity', message)
}

export function buildGraph(manifestInput: unknown, circuitInput: unknown, checksum: string): CircuitGraph {
  const manifestResult = manifestSchema.safeParse(manifestInput)
  if (!manifestResult.success) throw new CircuitError('schema', `Invalid manifest: ${manifestResult.error.message}`)
  const circuitResult = circuitSchema.safeParse(circuitInput)
  if (!circuitResult.success) throw new CircuitError('schema', `Invalid circuit: ${circuitResult.error.message}`)
  const manifest = manifestResult.data
  const circuit = circuitResult.data
  requireIntegrity(circuit.circuitId === manifest.circuitId, `Circuit ID ${circuit.circuitId} does not match manifest ${manifest.circuitId}`)
  requireIntegrity(checksum === manifest.output.sha256, 'Supplied circuit checksum does not match the manifest')
  const neurons = new Map<string, Neuron>()
  const outgoing = new Map<string, OutEdge[]>()
  let previousId: string | undefined
  for (const neuron of circuit.neurons) {
    requireIntegrity(!neurons.has(neuron.id), `Duplicate neuron ID ${neuron.id}`)
    requireIntegrity(previousId === undefined || compareIds(previousId, neuron.id) < 0, `Unsorted neuron ID ${neuron.id} after ${previousId}`)
    neurons.set(neuron.id, neuron)
    outgoing.set(neuron.id, [])
    previousId = neuron.id
  }
  const pairs = new Set<string>()
  let previousEdge: Connection | undefined
  let synapses = 0
  for (const edge of circuit.connections) {
    const pair = `${edge.source} -> ${edge.target}`
    requireIntegrity(!pairs.has(pair), `Duplicate connection ${pair}`)
    if (previousEdge) {
      const order = compareIds(previousEdge.source, edge.source) || compareIds(previousEdge.target, edge.target)
      requireIntegrity(order < 0, `Unsorted connection ${pair}`)
    }
    requireIntegrity(edge.source !== edge.target, `Self-connection ${pair}`)
    requireIntegrity(neurons.has(edge.source) && neurons.has(edge.target), `Missing endpoint for ${pair}`)
    requireIntegrity(Number.isSafeInteger(edge.synapseCount) && edge.synapseCount >= manifest.extraction.minSynapseCount, `Invalid synapse count ${edge.synapseCount} for ${pair}; minimum ${manifest.extraction.minSynapseCount}`)
    outgoing.get(edge.source)!.push({ target: edge.target, synapseCount: edge.synapseCount })
    pairs.add(pair)
    synapses += edge.synapseCount
    previousEdge = edge
  }
  requireIntegrity(neurons.size === manifest.counts.neurons, `Neuron count ${neurons.size} does not match manifest ${manifest.counts.neurons}`)
  requireIntegrity(pairs.size === manifest.counts.connections, `Connection count ${pairs.size} does not match manifest ${manifest.counts.connections}`)
  requireIntegrity(synapses === manifest.counts.synapses, `Synapse count ${synapses} does not match manifest ${manifest.counts.synapses}`)
  requireIntegrity(manifest.startNeuronIds.length > 0, 'No starting neuron IDs')
  const starts = new Set<string>()
  for (const id of manifest.startNeuronIds) {
    requireIntegrity(!starts.has(id), `Duplicate starting neuron ID ${id}`)
    requireIntegrity(neurons.has(id), `Unknown starting neuron ID ${id}`)
    requireIntegrity(outgoing.get(id)!.length > 0, `Starting neuron ${id} is a dead end`)
    starts.add(id)
  }
  return { manifest, checksum, neurons, outgoing, startNeuronIds: manifest.startNeuronIds }
}
