/**
 * Simulate a long radio session in the browser's learning loop (FlyMind) and measure the fly as it goes.
 *   node --import tsx scripts/brain/simulate-listening.ts [--phrases 6000] [--no-anchor]
 */
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'
import { checkpointSchema, decodeReadout, encodeReadout } from '../../src/brain/checkpoint'
import { readoutWidth } from '../../src/brain/perform'
import { writeFile } from 'node:fs/promises'
import { EVALUATION_PRESETS, flyPlayer, measurePlay } from '../../src/brain/evaluate'
import { FlyMind } from '../../src/brain/mind'
import { createBrainModel } from '../../src/brain/model'
import { loadBrainFromDisk } from './load'

const { values } = parseArgs({ options: { phrases: { type: 'string', default: '6000' }, 'no-anchor': { type: 'boolean', default: false }, out: { type: 'string' } } })
const { circuit } = await loadBrainFromDisk()
const model = createBrainModel(circuit)
const directory = new URL('../../public/data/brains/fly-v1/', import.meta.url)
const checkpoint = checkpointSchema.parse(JSON.parse(await readFile(new URL('checkpoint.json', directory), 'utf8')))
const shipped = decodeReadout(gunzipSync(await readFile(new URL('readout.bin.gzip', directory))), model)
const mind = new FlyMind(model, shipped, checkpoint, null)
mind.schoolAnchorEnabled = !values['no-anchor']
const label = values['no-anchor'] ? 'no anchor' : 'anchor'
const report = (played: number) => {
  const result = measurePlay(flyPlayer(model, mind.readoutSnapshot(), 0.8), 18, 6)
  console.log(`[${label}] after ${played} phrases: bananas ${(result.total * 10).toFixed(2)} progressions ${result.progressions} distinct ${(result.distinctPhrases * 100).toFixed(0)}% lead ${result.parts.lead.toFixed(2)}`)
}
report(0)
const total = Number(values.phrases)
for (let played = 1; played <= total; played++) {
  const song = Math.floor((played - 1) / 8)
  const recipe = { recipeVersion: 1 as const, presetId: EVALUATION_PRESETS[song % 3]!, sessionSeed: 1000 + song, variation: 0.5, tempoBpm: 72 }
  const phrase = mind.compose(recipe, (played - 1) % 8, (played - 1) % 8 === 0)
  mind.adopt(phrase.id)
  if (played % 1500 === 0) report(played)
}
if (values.out) await writeFile(values.out, encodeReadout(mind.readoutSnapshot(), readoutWidth(model)))
