import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { buildGraph } from '../../src/connectome/graph'
import { manifestSchema } from '../../src/connectome/schema'

it('validates the committed real MBON circuit and its checksum', () => {
  const directory = new URL('../../public/data/circuits/mbon-v1/', import.meta.url)
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')))
  const bytes = readFileSync(new URL('circuit.json', directory))
  const checksum = createHash('sha256').update(bytes).digest('hex')
  expect(checksum, 'Circuit checksum mismatch').toBe(manifest.output.sha256)
  expect(bytes.byteLength).toBe(manifest.output.bytes)
  const graph = buildGraph(manifest, JSON.parse(bytes.toString('utf8')), checksum)
  expect(graph.neurons.size).toBe(97)
  expect([...graph.outgoing.values()].reduce((sum, edges) => sum + edges.length, 0)).toBe(936)
  expect([...graph.outgoing.values()].flat().reduce((sum, edge) => sum + edge.synapseCount, 0)).toBe(25379)
  expect(graph.startNeuronIds).toEqual(['10704', '519373', '10013', '13768', '10495', '522749', '21242', '513174'])
  expect([...graph.neurons.values()].every(neuron => neuron.class === 'MBON')).toBe(true)
})
