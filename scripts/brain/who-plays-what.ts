/**
 * Aggregate per-beat attributions over many phrases: which neuron roles and types drive each layer.
 *   node --import tsx scripts/brain/who-plays-what.ts
 */
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { decodeReadout } from '../../src/brain/checkpoint'
import { EVALUATION_PRESETS } from '../../src/brain/evaluate'
import { createBrainModel } from '../../src/brain/model'
import { freshRuntime, perform } from '../../src/brain/perform'
import { createRng } from '../../src/music/rng'
import { loadBrainFromDisk } from './load'

const { circuit } = await loadBrainFromDisk()
const model = createBrainModel(circuit)
const readout = decodeReadout(gunzipSync(await readFile(new URL('../../public/data/brains/fly-v1/readout.bin.gzip', import.meta.url))), model)
const roles: Record<string, Record<string, number>> = {}
const types: Record<string, Record<string, number>> = {}
for (let session = 0; session < 30; session++) {
  const rng = createRng(`who|${session}`)
  let runtime = freshRuntime(model, rng)
  for (let phrase = 0; phrase < 6; phrase++) {
    const result = perform(model, readout, runtime, { temperature: 0.8, rng, presetId: EVALUATION_PRESETS[session % 3]!, explain: true })
    runtime = result.runtime
    for (const explanation of result.explanations!) {
      if (!explanation) continue
      const layer = explanation.head === 'kick' || explanation.head === 'snare' || explanation.head === 'hat' ? 'drums' : explanation.head
      for (const index of explanation.neurons) {
        const neuron = circuit.neurons[index]!
        ;(roles[layer] ??= {})[neuron.role] = (roles[layer]![neuron.role] ?? 0) + 1
        const type = (neuron.type ?? 'untyped').replace(/_[a-z]$/, '')
        ;(types[layer] ??= {})[type] = (types[layer]![type] ?? 0) + 1
      }
    }
  }
}
const available: Record<string, number> = {}
for (const index of model.readoutNeurons) available[circuit.neurons[index]!.role] = (available[circuit.neurons[index]!.role] ?? 0) + 1
const total = Object.values(available).reduce((a, b) => a + b, 0)
console.log('readout pool:', Object.entries(available).map(([role, count]) => `${role} ${(count / total * 100).toFixed(0)}%`).join(', '))
for (const layer of Object.keys(roles)) {
  const sum = Object.values(roles[layer]!).reduce((a, b) => a + b, 0)
  const top = Object.entries(types[layer]!).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => `${type} ${(count / sum * 100).toFixed(1)}%`)
  console.log(`${layer.padEnd(5)} roles: ${Object.entries(roles[layer]!).map(([role, count]) => `${role} ${(count / sum * 100).toFixed(0)}%`).join(', ')} | top types: ${top.join(', ')}`)
}
