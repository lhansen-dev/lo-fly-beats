import { readFileSync } from 'node:fs'
import { buildGraph } from '../../../src/connectome/graph'
import { circuitSchema, manifestSchema } from '../../../src/connectome/schema'
import type { Connection } from '../../../src/connectome/types'

export function fixtureGraph(modifyConnections?: (connections: Connection[]) => void) {
  const directory = new URL('../../fixtures/graphs/branching/', import.meta.url)
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')))
  const circuit = circuitSchema.parse(JSON.parse(readFileSync(new URL('circuit.json', directory), 'utf8')))
  if (modifyConnections) modifyConnections(circuit.connections)
  manifest.counts.connections = circuit.connections.length
  manifest.counts.synapses = circuit.connections.reduce((sum, edge: Connection) => sum + edge.synapseCount, 0)
  return buildGraph(manifest, circuit, manifest.output.sha256)
}
