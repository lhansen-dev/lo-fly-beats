import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { decodeBrainCircuit, parseBrainCircuit } from '../../../src/brain/circuit'
import { songCircuit } from './helpers'

const root = new URL('../../../public/data/circuits/song-v1/', import.meta.url)

describe('song circuit', () => {
  it('verifies the committed ear-to-song circuit and its counts', async () => {
    const circuit = await songCircuit()
    const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
    expect(circuit.neurons).toHaveLength(manifest.counts.neurons)
    expect(circuit.source).toHaveLength(manifest.counts.connections)
    expect([...circuit.synapses].reduce((sum, value) => sum + value, 0)).toBe(manifest.counts.synapses)
    const roles = Object.fromEntries(Object.keys(manifest.counts.roles).map(role => [role, circuit.neurons.filter(neuron => neuron.role === role).length]))
    expect(roles).toEqual(manifest.counts.roles)
    // Every song-circuit neuron keeps its MaleCNS identity, including the song command and wing motor neurons.
    const types = new Set(circuit.neurons.map(neuron => neuron.type))
    for (const type of ['pIP10', 'vPR6', 'dPR1', 'b1 MN', 'i1 MN', 'hg1 MN']) expect(types).toContain(type)
    expect(circuit.neurons.filter(neuron => neuron.role === 'ear').every(neuron => /^JO-[AB]/.test(neuron.type ?? ''))).toBe(true)
  })

  it('rejects tampered bytes before decompressing', async () => {
    const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
    const bytes = new Uint8Array(await readFile(new URL('brain.json.gzip', root)))
    bytes[100] = bytes[100]! ^ 0xff
    await expect(decodeBrainCircuit(manifest, bytes)).rejects.toThrow(/checksum/)
    await expect(decodeBrainCircuit(manifest, bytes.slice(1))).rejects.toThrow(/byte count/)
  })

  it('rejects self-connections, duplicates, missing neurons, and unsorted IDs', () => {
    const neuron = (id: string) => ({ id, type: null, instance: null, superclass: null, role: 'song', nt: null, soma: null })
    const base = { schemaVersion: 1, circuitId: 'song-v1', neurons: [neuron('1'), neuron('2')] }
    const edges = (source: number[], target: number[]) => ({ ...base, edges: { source, target, synapses: source.map(() => 3) } })
    expect(() => parseBrainCircuit(edges([0], [1]), 'x')).not.toThrow()
    expect(() => parseBrainCircuit(edges([0], [0]), 'x')).toThrow(/self/)
    expect(() => parseBrainCircuit(edges([0, 0], [1, 1]), 'x')).toThrow(/duplicate/)
    expect(() => parseBrainCircuit(edges([0], [5]), 'x')).toThrow(/missing/)
    expect(() => parseBrainCircuit({ ...base, neurons: [neuron('2'), neuron('1')], edges: { source: [], target: [], synapses: [] } }, 'x')).toThrow(/sorted/)
  })
})
