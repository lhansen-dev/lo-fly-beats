import { buildGraph } from './graph'
import { buildCompactGraph } from './compact'
import { manifestSchema } from './schema'
import { CircuitError } from './types'
import type { CircuitGraph } from './types'

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

function parseJson(text: string, name: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new CircuitError('schema', `Invalid JSON in ${name}`)
  }
}

export async function loadCircuit(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<CircuitGraph> {
  const directory = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}data/circuits/whole-cns-v1/`
  async function fetchBytes(file: string): Promise<ArrayBuffer> {
    try {
      const response = await fetchImpl(directory + file)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.arrayBuffer()
    } catch (error) {
      throw new CircuitError('network', `Could not fetch ${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const manifestInput = parseJson(new TextDecoder().decode(await fetchBytes('manifest.json')), 'manifest.json')
  const result = manifestSchema.safeParse(manifestInput)
  if (!result.success) throw new CircuitError('schema', `Invalid manifest: ${result.error.message}`)
  const manifest = result.data
  if (manifest.output.file === 'neurons.json.gzip') {
    if (manifest.schemaVersion !== 2) throw new CircuitError('schema', 'Compact circuit requires schema version 2')
    const fingerprint = await sha256Hex(new TextEncoder().encode(`${manifest.output.sha256}:${manifest.output.adjacency.sha256}`).buffer)
    if (fingerprint !== manifest.output.graphSha256) throw new CircuitError('checksum', 'Graph fingerprint does not match manifest')
    async function verifiedGzip(spec: { file: string; bytes: number; sha256: string }): Promise<ArrayBuffer> {
      const compressed = await fetchBytes(spec.file)
      if (await sha256Hex(compressed) !== spec.sha256) throw new CircuitError('checksum', `Checksum mismatch for ${spec.file}`)
      if (compressed.byteLength !== spec.bytes) throw new CircuitError('integrity', `Byte count mismatch for ${spec.file}`)
      try {
        return await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      } catch {
        throw new CircuitError('schema', `Invalid gzip data in ${spec.file}`)
      }
    }
    const [neuronBytes, adjacency] = await Promise.all([verifiedGzip(manifest.output), verifiedGzip(manifest.output.adjacency)])
    return buildCompactGraph(manifest, parseJson(new TextDecoder().decode(neuronBytes), 'neurons.json.gzip'), adjacency)
  }
  if (manifest.schemaVersion !== 1) throw new CircuitError('schema', 'JSON circuit requires schema version 1')
  const bytes = await fetchBytes('circuit.json')
  const checksum = await sha256Hex(bytes)
  if (checksum !== manifest.output.sha256) throw new CircuitError('checksum', `Circuit checksum mismatch: expected ${manifest.output.sha256}, received ${checksum}`)
  if (bytes.byteLength !== manifest.output.bytes) throw new CircuitError('integrity', `Circuit byte count ${bytes.byteLength} does not match manifest ${manifest.output.bytes}`)
  const circuit = parseJson(new TextDecoder().decode(bytes), 'circuit.json')
  return buildGraph(manifest, circuit, checksum)
}
