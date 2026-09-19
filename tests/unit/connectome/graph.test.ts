import { describe, expect, it } from 'vitest'
import { buildGraph, compareIds } from '../../../src/connectome/graph'
import { CircuitError } from '../../../src/connectome/types'
import type { CircuitErrorCode } from '../../../src/connectome/types'
import { fixture } from './fixture'

function expectError(run: () => unknown, code: CircuitErrorCode) {
  expect(run).toThrowError(CircuitError)
  expect(run).toThrowError(expect.objectContaining({ code }))
}

describe('buildGraph', () => {
  it('builds sorted adjacency including a dead end and unknown annotations', () => {
    const { manifest, circuit } = fixture()
    const graph = buildGraph(manifest, circuit, manifest.output.sha256)
    expect([...graph.neurons.keys()]).toEqual(['1', '2', '3', '4', '5'])
    expect(graph.outgoing.get('1')).toEqual([{ target: '2', synapseCount: 9 }, { target: '3', synapseCount: 1 }])
    expect(graph.outgoing.get('5')).toEqual([])
    expect(graph.neurons.get('5')?.type).toBeNull()
    expect(graph.startNeuronIds).toEqual(['1', '2'])
  })

  it('rejects schema violations before integrity checks', () => {
    const { manifest, circuit } = fixture()
    expectError(() => buildGraph(manifest, { ...circuit, schemaVersion: 2 }, manifest.output.sha256), 'schema')
    expectError(() => buildGraph({ ...manifest, schemaVersion: 2 }, circuit, manifest.output.sha256), 'schema')
    expectError(() => buildGraph(manifest, { ...circuit, neurons: [{ id: '01' }] }, manifest.output.sha256), 'schema')
  })

  const invalidCases: [string, (data: ReturnType<typeof fixture>) => void][] = [
    ['circuit ID mismatch', ({ circuit }) => { circuit.circuitId = 'wrong' }],
    ['duplicate neuron ID', ({ circuit }) => { circuit.neurons[1].id = '1' }],
    ['unsorted neurons', ({ circuit }) => { circuit.neurons.reverse() }],
    ['duplicate connection', ({ circuit }) => { circuit.connections.splice(1, 0, { ...circuit.connections[0] }) }],
    ['unsorted connections', ({ circuit }) => { circuit.connections.reverse() }],
    ['self-connection', ({ circuit }) => { circuit.connections[0].target = '1' }],
    ['unknown endpoint', ({ circuit }) => { circuit.connections[0].target = '99' }],
    ['fractional count', ({ circuit }) => { circuit.connections[0].synapseCount = 1.5 }],
    ['unsafe integer count', ({ circuit }) => { circuit.connections[0].synapseCount = Number.MAX_SAFE_INTEGER + 1 }],
    ['count below minimum', ({ circuit }) => { circuit.connections[0].synapseCount = 0 }],
    ['neuron count mismatch', ({ manifest }) => { manifest.counts.neurons++ }],
    ['connection count mismatch', ({ manifest }) => { manifest.counts.connections++ }],
    ['synapse total mismatch', ({ manifest }) => { manifest.counts.synapses++ }],
    ['unknown start', ({ manifest }) => { manifest.startNeuronIds = ['99'] }],
    ['dead-end start', ({ manifest }) => { manifest.startNeuronIds = ['5'] }],
    ['duplicate start', ({ manifest }) => { manifest.startNeuronIds = ['1', '1'] }],
    ['empty starts', ({ manifest }) => { manifest.startNeuronIds = [] }],
  ]
  it.each(invalidCases)('rejects %s', (_name, mutate) => {
    const data = fixture()
    mutate(data)
    expectError(() => buildGraph(data.manifest, data.circuit, data.manifest.output.sha256), 'integrity')
  })
})

it('compares numeric IDs without losing precision', () => {
  expect(['10000000000000000000', '10', '9999999999999999999', '2'].sort(compareIds))
    .toEqual(['2', '10', '9999999999999999999', '10000000000000000000'])
  expect(compareIds('10', '10')).toBe(0)
})
