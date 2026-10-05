import { describe, expect, it, vi } from 'vitest'
import { compareIds } from '../../../../src/connectome/graph'
import { buildReservoirGraph } from '../../../../src/music/learning/graph'
import { loadLearningCircuit } from '../../../../src/music/learning/load'
import { mbonGraph, reservoirGraph } from './fixture'
import { readFileSync } from 'node:fs'

describe('experimental graph loading and model rows', () => {
  it.each(['/', '/lo-fly-beats/', './'])('loads and verifies mbon-v1 explicitly under %s', async base => {
    const directory = new URL('../../../../public/data/circuits/mbon-v1/', import.meta.url)
    const manifest = readFileSync(new URL('manifest.json', directory))
    const circuit = readFileSync(new URL('circuit.json', directory))
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(manifest))
      .mockResolvedValueOnce(new Response(circuit))
    const loaded = await loadLearningCircuit(base, fetchImpl)
    expect(loaded.checksum).toBe(mbonGraph.checksum)
    expect(loaded.neurons.size).toBe(97)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `${base}data/circuits/mbon-v1/manifest.json`, `${base}data/circuits/mbon-v1/circuit.json`,
    ])
  })

  it('rejects corrupt bytes and an unexpected circuit identity', async () => {
    const directory = new URL('../../../../public/data/circuits/mbon-v1/', import.meta.url)
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'))
    const circuit = readFileSync(new URL('circuit.json', directory), 'utf8')
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(new Response(circuit + ' '))
    await expect(loadLearningCircuit('/', fetchImpl)).rejects.toMatchObject({ code: 'checksum' })
    // Even a mutually consistent manifest/file with the wrong identity is rejected.
    const replaced = circuit.replace('mbon-v1', 'other-v1')
    const { sha256Hex } = await import('../../../../src/connectome/load')
    const changedManifest = {
      ...manifest, circuitId: 'other-v1', output: { ...manifest.output, bytes: new TextEncoder().encode(replaced).length,
        sha256: await sha256Hex(new TextEncoder().encode(replaced).buffer) },
    }
    const wrongIdentity = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(changedManifest))
      .mockResolvedValueOnce(new Response(replaced))
    await expect(loadLearningCircuit('/', wrongIdentity)).rejects.toMatchObject({ code: 'integrity', message: 'Expected the mbon-v1 learning circuit' })
  })

  it('pins numeric IDs independently of map insertion order and keeps exactly the anatomical edges', () => {
    const before = structuredClone(mbonGraph)
    const reordered = { ...mbonGraph, neurons: new Map([...mbonGraph.neurons].reverse()), outgoing: new Map([...mbonGraph.outgoing].reverse()) }
    expect(buildReservoirGraph(reordered)).toEqual(reservoirGraph)
    expect(reservoirGraph.neuronIds).toEqual([...mbonGraph.neurons.keys()].sort(compareIds))
    let connections = 0
    let synapses = 0
    reservoirGraph.incoming.forEach((row, target) => {
      const total = row.reduce((sum, edge) => sum + edge.weight, 0)
      expect(total).toBeCloseTo(row.length ? 0.85 : 0, 14)
      const rawTotal = row.reduce((sum, edge) => sum + Math.log1p(edge.synapseCount), 0)
      for (const edge of row) {
        const sourceId = reservoirGraph.neuronIds[edge.sourceIndex]!
        expect(mbonGraph.outgoing.get(sourceId)).toContainEqual({ target: reservoirGraph.neuronIds[target], synapseCount: edge.synapseCount })
        expect(edge.weight).toBeCloseTo(Math.log1p(edge.synapseCount) / rawTotal * 0.85, 14)
        expect(edge.weight).toBeGreaterThan(0)
        synapses += edge.synapseCount
        connections++
      }
    })
    expect(connections).toBe(936)
    expect(synapses).toBe(25379)
    expect(mbonGraph).toEqual(before)
    expect(Object.isFrozen(reservoirGraph.incoming[0])).toBe(true)
  })
})
