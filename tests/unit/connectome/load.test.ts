import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { loadCircuit, sha256Hex } from '../../../src/connectome/load'
import { fixture } from './fixture'

function setup() {
  const { manifest, bytes } = fixture()
  const fetchImpl = vi.fn<typeof fetch>()
  fetchImpl.mockResolvedValueOnce(Response.json(manifest))
  fetchImpl.mockResolvedValueOnce(new Response(new Uint8Array(bytes)))
  return { manifest, bytes, fetchImpl }
}

describe('loadCircuit', () => {
  it.each(['/', '/lo-fly-beats/', './'])('loads a verified circuit under deployment base %s', async base => {
    const { fetchImpl, manifest } = setup()
    const graph = await loadCircuit(base, fetchImpl)
    expect(graph.neurons.size).toBe(5)
    expect(graph.checksum).toBe(manifest.output.sha256)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `${base}data/circuits/mbon-v1/manifest.json`, `${base}data/circuits/mbon-v1/circuit.json`,
    ])
  })

  it.each(['manifest', 'circuit'])('reports a 404 for the %s', async file => {
    const { fetchImpl, manifest } = setup()
    fetchImpl.mockReset()
    if (file === 'circuit') fetchImpl.mockResolvedValueOnce(Response.json(manifest))
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 404 }))
    await expect(loadCircuit('/', fetchImpl)).rejects.toMatchObject({ code: 'network' })
  })

  it('reports a rejected fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Offline'))
    await expect(loadCircuit('/', fetchImpl)).rejects.toMatchObject({ code: 'network', message: expect.stringContaining('Offline') })
  })

  it('rejects changed bytes before parsing or building the graph', async () => {
    const { manifest, bytes } = setup()
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(new Response(bytes.toString() + ' '))
    await expect(loadCircuit('/', fetchImpl)).rejects.toMatchObject({ code: 'checksum' })
  })

  it('rejects invalid JSON even when its checksum matches', async () => {
    const { manifest } = setup()
    const invalid = '{broken json'
    manifest.output.sha256 = createHash('sha256').update(invalid).digest('hex')
    manifest.output.bytes = Buffer.byteLength(invalid)
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(new Response(invalid))
    await expect(loadCircuit('/', fetchImpl)).rejects.toMatchObject({ code: 'schema' })
  })

  it('rejects an invalid manifest without requesting the circuit', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{'))
    await expect(loadCircuit('/', fetchImpl)).rejects.toMatchObject({ code: 'schema' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('computes a known SHA-256 digest', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc').buffer)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
