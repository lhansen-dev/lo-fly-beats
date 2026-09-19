import { buildGraph } from './graph'
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
  const directory = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}data/circuits/mbon-v1/`
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
  const bytes = await fetchBytes('circuit.json')
  const checksum = await sha256Hex(bytes)
  if (checksum !== manifest.output.sha256) throw new CircuitError('checksum', `Circuit checksum mismatch: expected ${manifest.output.sha256}, received ${checksum}`)
  if (bytes.byteLength !== manifest.output.bytes) throw new CircuitError('integrity', `Circuit byte count ${bytes.byteLength} does not match manifest ${manifest.output.bytes}`)
  const circuit = parseJson(new TextDecoder().decode(bytes), 'circuit.json')
  return buildGraph(manifest, circuit, checksum)
}
