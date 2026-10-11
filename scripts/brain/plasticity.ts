/**
 * Does learning inside the circuit help? Starting from the shipped fly with its readout frozen,
 * only the plastic synapses learn from bananas. A control receives shuffled "dopamine".
 *   node --import tsx scripts/brain/plasticity.ts [--batches 1500] [--rate 0.002] [--control]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'
import { decodeReadout } from '../../src/brain/checkpoint'
import { critique } from '../../src/brain/critic'
import { EVALUATION_PRESETS, measurePlay } from '../../src/brain/evaluate'
import { createBaseline, updateBaseline, plasticityStep } from '../../src/brain/learn'
import { createBrainModel } from '../../src/brain/model'
import { freshRuntime, perform, type FlyRuntime, type PhraseActions } from '../../src/brain/perform'
import { createRng } from '../../src/music/rng'
import type { PresetId } from '../../src/presets/types'
import { loadBrainFromDisk } from './load'

const { values } = parseArgs({ options: {
  batches: { type: 'string', default: '1500' }, rate: { type: 'string', default: '0.002' }, control: { type: 'boolean', default: false },
  batch: { type: 'string', default: '6' }, tag: { type: 'string' },
} })
const tag = values.tag ?? (values.control ? 'plasticity-control' : 'plasticity')
const { circuit } = await loadBrainFromDisk()
const model = createBrainModel(circuit)
const readout = decodeReadout(gunzipSync(await readFile(new URL('../../public/data/brains/fly-v1/readout.bin.gzip', import.meta.url))), model)
const gains = new Float32Array(model.plasticSlots.length).fill(1)
const rate = Number(values.rate)
const batchSize = Number(values.batch)
const rng = createRng(`plasticity|${tag}`)
const shuffle = createRng(`plasticity-shuffle|${tag}`)
const baseline = createBaseline()
const started = performance.now()

function measure(): number {
  let runtime = freshRuntime(model)
  let random = createRng('plasticity-eval')
  const player = (session: number, phrase: number, presetId: PresetId) => {
    if (phrase === 0) { random = createRng(`plasticity-eval|${session}`); runtime = freshRuntime(model, random) }
    const result = perform(model, readout, runtime, { temperature: 0.8, rng: random, presetId, gains })
    runtime = result.runtime
    return result.actions
  }
  return Math.round(measurePlay(player, 24, 6).total * 1000) / 100
}

const before = measure()
console.log(`[${tag}] ${model.plasticSlots.length} plastic synapses; bananas before ${before}`)
let players: { runtime: FlyRuntime; presetId: PresetId; previous: PhraseActions[] }[] = Array.from({ length: batchSize }, (_, index) => ({ runtime: freshRuntime(model, rng), presetId: EVALUATION_PRESETS[index % 3]!, previous: [] }))
const curve: { batch: number; bananas: number; meanGain: number; spread: number }[] = []
let running = 0
for (let batch = 1; batch <= Number(values.batches); batch++) {
  const eligibilities: Float32Array[] = []
  const totals: number[] = []
  players = players.map(player => {
    const result = perform(model, readout, player.runtime, { temperature: 1, rng, presetId: player.presetId, gains, eligibility: true })
    const critic = critique(result.actions, player.presetId, player.previous)
    eligibilities.push(result.eligibility!)
    totals.push(critic.total)
    updateBaseline(baseline, critic)
    running += critic.total
    return rng.float() < 0.15 ? { runtime: freshRuntime(model, rng), presetId: player.presetId, previous: [] } : { runtime: result.runtime, presetId: player.presetId, previous: [...player.previous, result.actions].slice(-4) }
  })
  let advantages = totals.map(total => (total - baseline.mean.total) / Math.sqrt(baseline.variance.total + 1e-4))
  if (values.control) advantages = advantages.map(() => advantages[Math.floor(shuffle.float() * advantages.length)]! * (shuffle.float() < 0.5 ? -1 : 1))
  if (batch > 10) plasticityStep(model, gains, eligibilities, advantages, rate)
  if (batch % 250 === 0) {
    let sum = 0
    let squares = 0
    for (const gain of gains) { sum += gain; squares += gain * gain }
    const mean = sum / gains.length
    const point = { batch, bananas: Math.round(running / (250 * batchSize) * 1000) / 100, meanGain: Math.round(mean * 1000) / 1000, spread: Math.round(Math.sqrt(squares / gains.length - mean * mean) * 1000) / 1000 }
    curve.push(point)
    running = 0
    console.log(`[${tag} ${((performance.now() - started) / 1000).toFixed(0)}s] batch ${batch} practicing ${point.bananas} gain mean ${point.meanGain} spread ${point.spread}`)
  }
}
const after = measure()
console.log(`[${tag}] bananas before ${before} after ${after}`)
await mkdir(new URL('../../artifacts/brain/', import.meta.url), { recursive: true })
await writeFile(new URL(`../../artifacts/brain/${tag}.json`, import.meta.url), JSON.stringify({ tag, rate, before, after, curve }, null, 2))
await writeFile(new URL(`../../artifacts/brain/${tag}-gains.bin`, import.meta.url), new Uint8Array(gains.buffer))
