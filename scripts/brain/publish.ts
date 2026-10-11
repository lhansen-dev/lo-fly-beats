/**
 * Publish a measured readout as the shipped fly, appending its training report's history.
 *   node --import tsx scripts/brain/publish.ts artifacts/brain/readout-<tag>.bin artifacts/brain/report-<tag>.json
 */
import { readFile, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { checkpointMetadata, checkpointSchema, decodeReadout, type BrainCheckpoint } from '../../src/brain/checkpoint'
import { createBrainModel } from '../../src/brain/model'
import { loadBrainFromDisk } from './load'

const [readoutPath, reportPath] = process.argv.slice(2)
if (!readoutPath || !reportPath) throw new Error('Usage: publish.ts <readout.bin> <report.json>')
const directory = new URL('../../public/data/brains/fly-v1/', import.meta.url)
const current = checkpointSchema.parse(JSON.parse(await readFile(new URL('checkpoint.json', directory), 'utf8')))
const report = JSON.parse(await readFile(reportPath, 'utf8')) as { budget: { schoolLessons: number; practicePhrases: number }; history: BrainCheckpoint['history'] }
const { circuit } = await loadBrainFromDisk()
const model = createBrainModel(circuit)
const encoded = new Uint8Array(await readFile(readoutPath))
decodeReadout(encoded, model)
const compressed = gzipSync(encoded, { level: 9 })
const checkpoint: BrainCheckpoint = {
  ...checkpointMetadata(model, {
    schoolLessons: current.experience.schoolLessons + report.budget.schoolLessons,
    practicePhrases: current.experience.practicePhrases + report.budget.practicePhrases,
    listeningPhrases: 0, bananasFromListeners: 0,
  }, report.history.slice(-400), new Date().toISOString()),
  readout: { encoding: 'int8-row-scaled-v1', file: 'readout.bin.gzip', bytes: compressed.byteLength, sha256: createHash('sha256').update(compressed).digest('hex') },
}
for (const [name, data] of [['readout.bin.gzip', compressed], ['checkpoint.json', JSON.stringify(checkpoint, null, 2) + '\n']] as const) {
  await writeFile(new URL(`${name}.tmp`, directory), data)
  await rename(new URL(`${name}.tmp`, directory), new URL(name, directory))
}
console.log(`published ${readoutPath}: ${checkpoint.experience.practicePhrases} practice phrases`)
