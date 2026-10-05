import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import { ADJACENCY_MAGIC, buildCompactGraph } from '../../../src/connectome/compact'
import { loadCircuit } from '../../../src/connectome/load'
import { fixture } from './fixture'

function compactFixture() {
  const { circuit, manifest: original } = fixture()
  const offsets = [0]
  const targets: number[] = [], weights: number[] = []
  for (const neuron of circuit.neurons) {
    for (const edge of circuit.connections.filter(edge => edge.source === neuron.id)) {
      targets.push(circuit.neurons.findIndex(node => node.id === edge.target))
      weights.push(edge.synapseCount)
    }
    offsets.push(targets.length)
  }
  const words = new Uint32Array([ADJACENCY_MAGIC, circuit.neurons.length, targets.length, 1, 0, ...offsets, ...targets, ...weights])
  const neurons = { schemaVersion: 2 as const, circuitId: circuit.circuitId, neurons: circuit.neurons }
  const neuronBytes = gzipSync(JSON.stringify(neurons))
  const adjacencyBytes = gzipSync(words)
  const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
  const output = {
    file: 'neurons.json.gzip' as const, bytes: neuronBytes.length, sha256: sha256(neuronBytes), graphSha256: '',
    adjacency: { file: 'adjacency.bin.gzip' as const, encoding: 'csr-u32-le-v1' as const, bytes: adjacencyBytes.length, sha256: sha256(adjacencyBytes), uncompressedBytes: words.byteLength },
  }
  output.graphSha256 = sha256(`${output.sha256}:${output.adjacency.sha256}`)
  const manifest = { ...original, schemaVersion: 2 as const, startNeuronIds: [], output }
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = String(input)
    if (url.endsWith('manifest.json')) return Response.json(manifest)
    return new Response(new Uint8Array(url.endsWith('neurons.json.gzip') ? neuronBytes : adjacencyBytes))
  })
  return { manifest, neurons, words, fetchImpl, circuit }
}

describe('compact whole-connectome graph', () => {
  it('exposes complete sorted rows through the same graph API, including null annotations and dead ends', () => {
    const { manifest, neurons, words, circuit } = compactFixture()
    const graph = buildCompactGraph(manifest, neurons, words.buffer)
    expect(graph.outgoing.size).toBe(5)
    expect(graph.outgoing.get('1')).toEqual([{ target: '2', synapseCount: 9 }, { target: '3', synapseCount: 1 }])
    expect(graph.outgoing.get('5')).toEqual([])
    expect(graph.outgoing.has('5')).toBe(true)
    expect(graph.outgoing.has('99')).toBe(false)
    expect(graph.outgoing.get('99')).toBeUndefined()
    expect(graph.startNeuronIds).toEqual(['1', '2', '3', '4'])
    expect([...graph.outgoing].flatMap(([source, edges]) => edges.map(edge => ({ source, ...edge })))).toEqual(circuit.connections)
    expect([...graph.outgoing.keys()]).toEqual(circuit.neurons.map(node => node.id))
    expect([...graph.outgoing.values()].flat()).toHaveLength(6)
    const rows: string[] = []
    graph.outgoing.forEach((_edges, id) => rows.push(id))
    expect(rows).toEqual(circuit.neurons.map(node => node.id))
    expect(graph.neurons.get('5')?.type).toBeNull()
    expect(graph.checksum).toBe(manifest.output.graphSha256)
  })

  it.each([
    ['bad magic', 0, 0], ['bad neuron count', 1, 4], ['bad edge count', 2, 5],
    ['bad threshold', 3, 2], ['reserved header word', 4, 1],
    ['invalid first offset', 5, 1], ['offset past the last edge', 6, 100],
    ['offsets out of order', 7, 0], ['unknown target', 11, 99],
    ['self connection', 11, 0], ['duplicate target', 12, 1], ['zero weight', 17, 0],
    ['changed weight total', 17, 8],
  ])('rejects %s', (_label, word, value) => {
    const { manifest, neurons, words } = compactFixture()
    words[word as number] = value as number
    expect(() => buildCompactGraph(manifest, neurons, words.buffer)).toThrowError(expect.objectContaining({ code: 'integrity' }))
  })

  it('rejects truncated bytes, annotation changes, and counts that disagree with the manifest', () => {
    const { manifest, neurons, words } = compactFixture()
    expect(() => buildCompactGraph(manifest, neurons, words.buffer.slice(0, -4))).toThrowError(expect.objectContaining({ code: 'integrity' }))
    neurons.neurons.reverse()
    expect(() => buildCompactGraph(manifest, neurons, words.buffer)).toThrowError(expect.objectContaining({ code: 'integrity' }))
    neurons.neurons.reverse()
    manifest.counts.deadEnds++
    expect(() => buildCompactGraph(manifest, neurons, words.buffer)).toThrowError(expect.objectContaining({ code: 'integrity' }))
  })

  it.each(['/', '/nested/lofly/', './'])('verifies and decompresses both assets under %s', async base => {
    const { fetchImpl, manifest } = compactFixture()
    const graph = await loadCircuit(base, fetchImpl)
    expect(graph.checksum).toBe(manifest.output.graphSha256)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `${base}data/circuits/whole-cns-v1/manifest.json`,
      `${base}data/circuits/whole-cns-v1/neurons.json.gzip`,
      `${base}data/circuits/whole-cns-v1/adjacency.bin.gzip`,
    ])
  })

  it.each(['neurons.json.gzip', 'adjacency.bin.gzip'])('rejects corrupted %s before decompression', async file => {
    const { fetchImpl } = compactFixture()
    const original = fetchImpl.getMockImplementation()!
    fetchImpl.mockImplementation(async (...args) => String(args[0]).endsWith(file) ? new Response('corrupted') : original(...args))
    await expect(loadCircuit('/', fetchImpl)).rejects.toMatchObject({ code: 'checksum' })
  })

  it('rejects a graph fingerprint that no longer matches both assets', async () => {
    const { manifest, fetchImpl } = compactFixture()
    manifest.output.graphSha256 = '0'.repeat(64)
    await expect(loadCircuit('/', fetchImpl)).rejects.toMatchObject({ code: 'checksum' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
