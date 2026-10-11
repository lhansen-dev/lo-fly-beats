import { z } from 'zod'

export const BRAIN_CIRCUIT_ID = 'song-v1'
export const NEURON_ROLES = ['ear', 'wing', 'auditory', 'premotor', 'song', 'motor'] as const
export type NeuronRole = typeof NEURON_ROLES[number]

const neuronSchema = z.strictObject({
  id: z.string().regex(/^[1-9][0-9]*$/),
  type: z.string().nullable(),
  instance: z.string().nullable(),
  superclass: z.string().nullable(),
  role: z.enum(NEURON_ROLES),
  nt: z.string().nullable(),
  soma: z.tuple([z.number().int(), z.number().int(), z.number().int()]).nullable(),
})

const brainSchema = z.strictObject({
  schemaVersion: z.literal(1),
  circuitId: z.literal(BRAIN_CIRCUIT_ID),
  neurons: z.array(neuronSchema).min(1),
  edges: z.strictObject({
    source: z.array(z.number().int().nonnegative()),
    target: z.array(z.number().int().nonnegative()),
    synapses: z.array(z.number().int().positive()),
  }),
})

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  circuitId: z.literal(BRAIN_CIRCUIT_ID),
  title: z.string(),
  counts: z.object({ neurons: z.number().int(), connections: z.number().int(), synapses: z.number().int() }),
  output: z.object({ file: z.literal('brain.json.gzip'), bytes: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
}).passthrough()

export type BrainNeuron = z.infer<typeof neuronSchema>
export type BrainManifest = z.infer<typeof manifestSchema>

/** Anatomical source data. Synapse counts are never modified; modeled weights live in the model. */
export interface BrainCircuit {
  circuitId: typeof BRAIN_CIRCUIT_ID
  checksum: string
  neurons: readonly BrainNeuron[]
  source: Int32Array
  target: Int32Array
  synapses: Int32Array
}

export function parseBrainCircuit(input: unknown, checksum: string): BrainCircuit {
  const parsed = brainSchema.parse(input)
  const { source, target, synapses } = parsed.edges
  const count = parsed.neurons.length
  if (source.length !== target.length || source.length !== synapses.length) throw new Error('Brain edge arrays differ in length')
  const seen = new Set<string>()
  for (let edge = 0; edge < source.length; edge++) {
    const from = source[edge]!
    const to = target[edge]!
    if (from >= count || to >= count) throw new Error('Brain edge references a missing neuron')
    if (from === to) throw new Error('Brain contains a self-connection')
    const key = `${from}>${to}`
    if (seen.has(key)) throw new Error('Brain contains a duplicate connection')
    seen.add(key)
  }
  let previous = 0n
  for (const neuron of parsed.neurons) {
    const id = BigInt(neuron.id)
    if (id <= previous) throw new Error('Brain neurons must be sorted by numeric ID')
    previous = id
  }
  return Object.freeze({
    circuitId: parsed.circuitId, checksum, neurons: Object.freeze(parsed.neurons),
    source: Int32Array.from(source), target: Int32Array.from(target), synapses: Int32Array.from(synapses),
  })
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** Verify the manifest's byte count and SHA-256 before decompressing, like the whole-CNS loader. */
export async function decodeBrainCircuit(manifestInput: unknown, compressed: Uint8Array): Promise<{ manifest: BrainManifest; circuit: BrainCircuit }> {
  const manifest = manifestSchema.parse(manifestInput)
  if (compressed.byteLength !== manifest.output.bytes) throw new Error('Brain byte count does not match manifest')
  const checksum = await sha256Hex(compressed)
  if (checksum !== manifest.output.sha256) throw new Error('Brain checksum does not match manifest')
  const circuit = parseBrainCircuit(JSON.parse(await gunzip(compressed)), checksum)
  if (circuit.neurons.length !== manifest.counts.neurons || circuit.source.length !== manifest.counts.connections) {
    throw new Error('Brain counts do not match manifest')
  }
  return { manifest, circuit }
}

export async function loadBrainCircuit(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<{ manifest: BrainManifest; circuit: BrainCircuit }> {
  const root = new URL(`data/circuits/${BRAIN_CIRCUIT_ID}/`, new URL(baseUrl, globalThis.location?.href ?? 'file:///'))
  const manifestResponse = await fetchImpl(new URL('manifest.json', root).href)
  if (!manifestResponse.ok) throw new Error(`Could not load the fly brain manifest (${manifestResponse.status})`)
  const manifest: unknown = await manifestResponse.json()
  const brainResponse = await fetchImpl(new URL('brain.json.gzip', root).href)
  if (!brainResponse.ok) throw new Error(`Could not load the fly brain (${brainResponse.status})`)
  return decodeBrainCircuit(manifest, new Uint8Array(await brainResponse.arrayBuffer()))
}
