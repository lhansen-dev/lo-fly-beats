/**
 * Measure a trained fly without training it: the published brain by default, or a readout file.
 *   node --import tsx scripts/brain/evaluate.ts [--readout artifacts/brain/readout-long.bin] [--connectivity anatomical] [--sessions 30]
 */
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'
import { decodeReadout } from '../../src/brain/checkpoint'
import { flyPlayer, measurePlay, tutorPlayer, tutorVocabulary } from '../../src/brain/evaluate'
import { createBrainModel, type Connectivity } from '../../src/brain/model'
import { loadBrainFromDisk } from './load'

const { values } = parseArgs({ options: {
  readout: { type: 'string' }, connectivity: { type: 'string', default: 'anatomical' }, seed: { type: 'string', default: '1' },
  sessions: { type: 'string', default: '30' }, tutor: { type: 'boolean', default: false },
} })
const { circuit } = await loadBrainFromDisk()
const model = createBrainModel(circuit, Number(values.seed), values.connectivity as Connectivity)
const bytes = values.readout
  ? new Uint8Array(await readFile(values.readout))
  : new Uint8Array(gunzipSync(await readFile(new URL('../../public/data/brains/fly-v1/readout.bin.gzip', import.meta.url))))
const readout = decodeReadout(bytes, model)
const vocabulary = tutorVocabulary()
const sessions = Number(values.sessions)
const players: [string, ReturnType<typeof flyPlayer>][] = [['T=1', flyPlayer(model, readout, 1)], ['T=0.8', flyPlayer(model, readout, 0.8)], ['T=0.6', flyPlayer(model, readout, 0.6)]]
if (values.tutor) players.unshift(['tutor', tutorPlayer()])
for (const [name, player] of players) {
  const result = measurePlay(player, sessions, 6, vocabulary)
  const pct = (value: number) => `${Math.round(value * 100)}%`
  console.log(`${name.padEnd(6)} bananas ${(result.total * 10).toFixed(2)} progressions ${result.progressions} original d/b/l ${pct(result.originality.drums)}/${pct(result.originality.bass)}/${pct(result.originality.lead)} sections ${Object.entries(result.sections).map(([key, value]) => `${key} ${pct(value)}`).join(', ')} realized ${pct(result.realized)} parts ${Object.entries(result.parts).map(([key, value]) => `${key}:${value.toFixed(2)}`).join(' ')}`)
}
