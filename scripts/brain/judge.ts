/**
 * An independent judge: a position-aware trigram model per layer, fit on tutor phrases from seeds the
 * fly never trained on. Lower bits per decision means more idiomatic. It is not the critic the fly
 * optimized, so it checks whether practice drifted into critic-pleasing but unidiomatic music.
 *   node --import tsx scripts/brain/judge.ts [--readout file.bin ...]
 */
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'
import { decodeReadout } from '../../src/brain/checkpoint'
import { EVALUATION_PRESETS } from '../../src/brain/evaluate'
import { createBrainModel } from '../../src/brain/model'
import { createReadout, freshRuntime, perform, type PhraseActions } from '../../src/brain/perform'
import { createTutor, tutorPhrase } from '../../src/brain/tutor'
import { HEADS, STEP_HEADS, type StepHead } from '../../src/brain/vocabulary'
import { createRng } from '../../src/music/rng'
import { loadBrainFromDisk } from './load'

const { values } = parseArgs({ options: { readout: { type: 'string', multiple: true, default: [] } } })
type Counts = Map<string, Map<number, number>>
const models = Object.fromEntries(STEP_HEADS.map(head => [head, new Map()])) as Record<StepHead, Counts>
const key = (steps: readonly number[], step: number) => `${step % 16}|${steps[step - 1] ?? -1}|${steps[step - 2] ?? -1}`
function fit(actions: PhraseActions) {
  for (const head of STEP_HEADS) {
    const steps = actions.steps[head]
    for (let step = 0; step < steps.length; step++) {
      const context = key(steps, step)
      const table = models[head].get(context) ?? new Map<number, number>()
      table.set(steps[step]!, (table.get(steps[step]!) ?? 0) + 1)
      models[head].set(context, table)
    }
  }
}
function bits(actions: PhraseActions): Record<StepHead, number> {
  return Object.fromEntries(STEP_HEADS.map(head => {
    const steps = actions.steps[head]
    const size = HEADS[head].length
    let total = 0
    for (let step = 0; step < steps.length; step++) {
      const table = models[head].get(key(steps, step))
      const count = table?.get(steps[step]!) ?? 0
      const sum = table ? [...table.values()].reduce((a, b) => a + b, 0) : 0
      // Add-half smoothing over the head's vocabulary.
      total -= Math.log2((count + 0.5) / (sum + 0.5 * size))
    }
    return [head, total / steps.length]
  })) as Record<StepHead, number>
}
for (let song = 0; song < 300; song++) {
  const rng = createRng(`judge-fit|${song}`)
  const tutor = createTutor(EVALUATION_PRESETS[song % 3]!, rng)
  for (let phrase = 0; phrase < 6; phrase++) fit(tutorPhrase(tutor, rng))
}

const { circuit } = await loadBrainFromDisk()
const model = createBrainModel(circuit)
const shipped = decodeReadout(gunzipSync(await readFile(new URL('../../public/data/brains/fly-v1/readout.bin.gzip', import.meta.url))), model)
const players: [string, (session: number) => PhraseActions[]][] = [
  ['tutor (held-out seeds)', session => { const rng = createRng(`judge-heldout|${session}`); const tutor = createTutor(EVALUATION_PRESETS[session % 3]!, rng); return Array.from({ length: 6 }, () => tutorPhrase(tutor, rng)) }],
]
const flyPlayer = (readout: Float32Array, temperature: number) => (session: number) => {
  const rng = createRng(`judge-fly|${session}`)
  let runtime = freshRuntime(model, rng)
  return Array.from({ length: 6 }, () => { const result = perform(model, readout, runtime, { temperature, rng, presetId: EVALUATION_PRESETS[session % 3]! }); runtime = result.runtime; return result.actions })
}
players.push(['shipped fly T=0.8', flyPlayer(shipped, 0.8)], ['shipped fly T=1', flyPlayer(shipped, 1)], ['untrained fly', flyPlayer(createReadout(model), 1)])
for (const path of values.readout) players.push([path.split('/').pop()!, flyPlayer(decodeReadout(new Uint8Array(await readFile(path)), model), 0.8)])

console.log(`| Player | ${STEP_HEADS.join(' | ')} | Mean bits/decision |`)
console.log(`| --- | ${STEP_HEADS.map(() => '---:').join(' | ')} | ---: |`)
for (const [name, play] of players) {
  const sums = Object.fromEntries(STEP_HEADS.map(head => [head, 0])) as Record<StepHead, number>
  let count = 0
  for (let session = 0; session < 30; session++) for (const actions of play(session)) {
    const b = bits(actions)
    for (const head of STEP_HEADS) sums[head] += b[head]
    count++
  }
  const means = STEP_HEADS.map(head => sums[head] / count)
  console.log(`| ${name} | ${means.map(v => v.toFixed(3)).join(' | ')} | ${(means.reduce((a, b) => a + b, 0) / means.length).toFixed(3)} |`)
}
