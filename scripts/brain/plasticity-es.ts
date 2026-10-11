/**
 * Stage 2, second attempt: learn the plastic synapse gains by paired weight perturbation (evolution
 * strategies), with the readout frozen. Each batch plays the same seeds with gains + noise and
 * gains - noise and moves the gains toward the better side.
 *   node --import tsx scripts/brain/plasticity-es.ts [--batches 800] [--sigma 0.05] [--rate 0.02] [--control]
 */
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'
import { decodeReadout } from '../../src/brain/checkpoint'
import { critique } from '../../src/brain/critic'
import { EVALUATION_PRESETS, measurePlay } from '../../src/brain/evaluate'
import { createBrainModel, PLASTICITY_CONFIGURATION } from '../../src/brain/model'
import { freshRuntime, perform, type PhraseActions } from '../../src/brain/perform'
import { createRng } from '../../src/music/rng'
import type { PresetId } from '../../src/presets/types'
import { loadBrainFromDisk } from './load'

const { values } = parseArgs({ options: {
  batches: { type: 'string', default: '800' }, sigma: { type: 'string', default: '0.05' }, rate: { type: 'string', default: '0.02' },
  control: { type: 'boolean', default: false }, tag: { type: 'string' },
} })
const tag = values.tag ?? (values.control ? 'es-control' : 'es')
const sigma = Number(values.sigma)
const rate = Number(values.rate)
const { circuit } = await loadBrainFromDisk()
const model = createBrainModel(circuit)
const readout = decodeReadout(gunzipSync(await readFile(new URL('../../public/data/brains/fly-v1/readout.bin.gzip', import.meta.url))), model)
const size = model.plasticSlots.length
const gains = new Float32Array(size).fill(1)
const noiseRng = createRng(`es-noise|${tag}`)
const gaussian = () => { const u = Math.max(1e-12, noiseRng.float()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * noiseRng.float()) }
const clamp = (value: number) => Math.min(PLASTICITY_CONFIGURATION.maxGain, Math.max(PLASTICITY_CONFIGURATION.minGain, value))

/** Score a gain vector on a short two-phrase song from a given seed. */
function score(candidate: Float32Array, seed: string, presetId: PresetId): number {
  const rng = createRng(seed)
  let runtime = freshRuntime(model, rng)
  const previous: PhraseActions[] = []
  let total = 0
  for (let phrase = 0; phrase < 2; phrase++) {
    const result = perform(model, readout, runtime, { temperature: 0.8, rng, presetId, gains: candidate })
    runtime = result.runtime
    total += critique(result.actions, presetId, previous).total
    previous.push(result.actions)
  }
  return total / 2
}

function evaluate(): number {
  let runtime = freshRuntime(model)
  let random = createRng('es-eval')
  const player = (session: number, phrase: number, presetId: PresetId) => {
    if (phrase === 0) { random = createRng(`es-eval|${session}`); runtime = freshRuntime(model, random) }
    const result = perform(model, readout, runtime, { temperature: 0.8, rng: random, presetId, gains })
    runtime = result.runtime
    return result.actions
  }
  return Math.round(measurePlay(player, 24, 6).total * 1000) / 100
}

const started = performance.now()
console.log(`[${tag}] ${size} plastic synapses; before ${evaluate()}`)
const plus = new Float32Array(size)
const minus = new Float32Array(size)
const noise = new Float32Array(size)
for (let batch = 1; batch <= Number(values.batches); batch++) {
  for (let index = 0; index < size; index++) {
    noise[index] = gaussian()
    plus[index] = clamp(gains[index]! + sigma * noise[index]!)
    minus[index] = clamp(gains[index]! - sigma * noise[index]!)
  }
  let difference = 0
  for (let pair = 0; pair < 3; pair++) {
    const presetId = EVALUATION_PRESETS[(batch + pair) % 3]!
    const seed = `es|${batch}|${pair}`
    difference += score(plus, seed, presetId) - score(minus, seed, presetId)
  }
  // The control moves along the same noise with a random sign, so only reward can make it consistent.
  const signal = values.control ? (noiseRng.float() < 0.5 ? -1 : 1) * Math.abs(difference) : difference
  for (let index = 0; index < size; index++) gains[index] = clamp(gains[index]! + rate * signal / (2 * sigma) * noise[index]! * sigma)
  if (batch % 400 === 0) {
    let spread = 0
    for (const gain of gains) spread += (gain - 1) ** 2
    console.log(`[${tag} ${((performance.now() - started) / 1000).toFixed(0)}s] batch ${batch} gain spread ${Math.sqrt(spread / size).toFixed(3)} bananas ${evaluate()}`)
  }
}
await writeFile(new URL(`../../artifacts/brain/${tag}-gains.bin`, import.meta.url), new Uint8Array(gains.buffer))
