/// <reference lib="webworker" />
import { loadBrainCircuit } from './circuit'
import { checkpointSchema, decodeReadout } from './checkpoint'
import { FlyMind } from './mind'
import { createBrainModel } from './model'
import type { BrainAtlas, BrainRequest, BrainResponse } from './protocol'
import { createBrainStore } from './store'

declare const self: DedicatedWorkerGlobalScope

let mind: FlyMind | null = null

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function initialize(baseUrl: string): Promise<Extract<BrainResponse, { type: 'initialized' }>> {
  const { circuit } = await loadBrainCircuit(baseUrl)
  const model = createBrainModel(circuit)
  const root = new URL('data/brains/fly-v1/', new URL(baseUrl, self.location.href))
  const checkpointResponse = await fetch(new URL('checkpoint.json', root))
  if (!checkpointResponse.ok) throw new Error(`Could not load the trained fly (${checkpointResponse.status})`)
  const checkpoint = checkpointSchema.parse(await checkpointResponse.json())
  const readoutResponse = await fetch(new URL(checkpoint.readout.file, root))
  if (!readoutResponse.ok) throw new Error(`Could not load the fly's learned connections (${readoutResponse.status})`)
  const compressed = new Uint8Array(await readoutResponse.arrayBuffer())
  if (compressed.byteLength !== checkpoint.readout.bytes || await sha256Hex(compressed) !== checkpoint.readout.sha256) {
    throw new Error("The fly's learned connections failed their checksum")
  }
  const raw = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
  mind = new FlyMind(model, decodeReadout(raw, model), checkpoint, createBrainStore())
  try { await mind.restore() } catch { /* a missing or broken store keeps the shipped fly */ }
  const positions = new Float32Array(circuit.neurons.length * 2)
  circuit.neurons.forEach((neuron, index) => {
    positions[index * 2] = neuron.soma ? neuron.soma[0] : Number.NaN
    positions[index * 2 + 1] = neuron.soma ? neuron.soma[2] : Number.NaN
  })
  const atlas: BrainAtlas = {
    ids: circuit.neurons.map(neuron => neuron.id), types: circuit.neurons.map(neuron => neuron.type),
    roles: circuit.neurons.map(neuron => neuron.role), positions, connections: circuit.source.length,
    readoutNeurons: model.readoutNeurons.length,
  }
  return { type: 'initialized', id: 0, atlas, state: mind.state() }
}

async function handle(message: BrainRequest): Promise<{ response: BrainResponse; transfer?: Transferable[] }> {
  if (message.type === 'initialize') return { response: { ...(await initialize(message.baseUrl)), id: message.id } }
  if (!mind) throw new Error('The fly brain is not loaded yet')
  switch (message.type) {
    case 'compose': {
      const phrase = mind.compose(message.recipe, message.phraseIndex, message.fresh)
      return { response: { type: 'composed', id: message.id, phrase } }
    }
    case 'adopt': {
      const learned = mind.adopt(message.phraseId)
      return { response: { type: 'adopted', id: message.id, state: mind.state(), learned } }
    }
    case 'banana': {
      mind.banana(message.phraseId)
      return { response: { type: 'bananaReceived', id: message.id, state: mind.state() } }
    }
    case 'forget': {
      await mind.forget()
      return { response: { type: 'forgotten', id: message.id, state: mind.state() } }
    }
  }
}

self.onmessage = (event: MessageEvent<BrainRequest>) => {
  const message = event.data
  void handle(message).then(
    ({ response, transfer }) => self.postMessage(response, transfer ?? []),
    error => self.postMessage({ type: 'error', id: message.id, message: error instanceof Error ? error.message : String(error) } satisfies BrainResponse),
  )
}
