/**
 * Train the fly: school (listen to the tutor and anticipate it), then practice (play alone and earn
 * bananas from the critic). Writes the shipped brain for the anatomical fly, and a report for any
 * connectivity, so controls can be trained under the same budget.
 *
 *   node --import tsx scripts/brain/train.ts [--connectivity anatomical] [--school 1500] [--practice 3000]
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { cpus } from 'node:os'
import { parseArgs } from 'node:util'
import { checkpointMetadata, checkpointSchema, decodeReadout, encodeReadout, type BrainCheckpoint } from '../../src/brain/checkpoint'
import { EVALUATION_PRESETS, flyPlayer, measurePlay, tutorPlayer, tutorVocabulary, type PlayMeasurement } from '../../src/brain/evaluate'
import { createBaseline, createOptimizer, lesson, LEARNING_CONFIGURATION, mergeStats, practiceBatch, type LessonStats } from '../../src/brain/learn'
import { BRAIN_CONFIGURATION, createBrainModel, type Connectivity } from '../../src/brain/model'
import { createReadout, freshRuntime, readoutWidth, type FlyRuntime, type PhraseActions } from '../../src/brain/perform'
import { createTutor, tutorPhrase } from '../../src/brain/tutor'
import { createRng } from '../../src/music/rng'
import type { PresetId } from '../../src/presets/types'
import { loadBrainFromDisk } from './load'

const { values } = parseArgs({
  options: {
    connectivity: { type: 'string', default: 'anatomical' },
    school: { type: 'string', default: '1500' },
    practice: { type: 'string', default: '3000' },
    batch: { type: 'string', default: '6' },
    seed: { type: 'string', default: '1' },
    'eval-sessions': { type: 'string', default: '30' },
    publish: { type: 'boolean', default: false },
    tag: { type: 'string' },
    /** Continue from the published fly instead of a blank readout; school is skipped unless requested. */
    resume: { type: 'boolean', default: false },
  },
})
const connectivity = values.connectivity as Connectivity
const schoolLessons = values.resume && process.argv.every(argument => !argument.startsWith('--school')) ? 0 : Number(values.school)
const practiceBatches = Number(values.practice)
const batchSize = Number(values.batch)
const evalSessions = Number(values['eval-sessions'])
const tag = values.tag ?? connectivity
const started = performance.now()
const elapsed = () => `${((performance.now() - started) / 1000).toFixed(0)}s`

const { circuit } = await loadBrainFromDisk()
const model = createBrainModel(circuit, Number(values.seed), connectivity)
const readout = createReadout(model)
const presets = EVALUATION_PRESETS
const history: BrainCheckpoint['history'] = []
const prior = { schoolLessons: 0, practicePhrases: 0 }
if (values.resume) {
  const directory = new URL('../../public/data/brains/fly-v1/', import.meta.url)
  const published = checkpointSchema.parse(JSON.parse(await readFile(new URL('checkpoint.json', directory), 'utf8')))
  readout.set(decodeReadout(gunzipSync(await readFile(new URL(published.readout.file, directory))), model))
  history.push(...published.history.filter(point => point.stage !== 'listening'))
  prior.schoolLessons = published.experience.schoolLessons
  prior.practicePhrases = published.experience.practicePhrases
}
const log = (message: string) => console.log(`[${values.tag ?? connectivity} ${elapsed()}] ${message}`)
log(`brain: ${model.size} neurons, ${circuit.source.length} connections, readout from ${model.readoutNeurons.length} song-side neurons, ${readout.length} weights`)

const quickBananas = () => {
  const measurement = measurePlay(flyPlayer(model, readout, 0.8, 'progress'), 6, 2)
  return Math.round(measurement.total * 100) / 10
}

// School
const schoolOptimizer = createOptimizer(readout.length)
let stats: LessonStats = {}
for (let lessonIndex = 0; lessonIndex < schoolLessons;) {
  const rng = createRng(`school|${connectivity}|${lessonIndex}`)
  const presetId = presets[(lessonIndex / 6 | 0) % 3]!
  const tutor = createTutor(presetId, rng)
  let runtime = freshRuntime(model, rng)
  for (let phrase = 0; phrase < 6 && lessonIndex < schoolLessons; phrase++, lessonIndex++) {
    const result = lesson(model, readout, schoolOptimizer, runtime, tutorPhrase(tutor, rng), presetId, rng, LEARNING_CONFIGURATION.schoolRate)
    runtime = result.runtime
    mergeStats(stats, result.stats)
    if ((lessonIndex + 1) % 150 === 0) {
      const bananas = quickBananas()
      history.push({ stage: 'school', phrases: prior.schoolLessons + lessonIndex + 1, bananas })
      log(`school ${lessonIndex + 1}/${schoolLessons} bananas ${bananas} ${Object.entries(stats).map(([head, value]) => `${head}:${(value.correct / value.count * 100).toFixed(0)}%`).join(' ')}`)
      stats = {}
    }
  }
}
const afterSchool = readout.slice()

// Practice
const practiceOptimizer = createOptimizer(readout.length)
const baseline = createBaseline()
const rng = createRng(`practice|${connectivity}`)
let players: { runtime: FlyRuntime; presetId: PresetId; previous: PhraseActions[] }[] = Array.from({ length: batchSize }, (_, index) => ({
  runtime: freshRuntime(model, rng), presetId: presets[index % 3]!, previous: [],
}))
const tutorRng = createRng(`practice-tutor|${connectivity}`)
let tutor = createTutor(presets[0]!, tutorRng)
let anchorRuntime = freshRuntime(model, tutorRng)
let running = 0
let runningCount = 0
const repertoire: string[] = []
for (let batch = 1; batch <= practiceBatches; batch++) {
  if (batch % 8 === 0) {
    tutor = createTutor(presets[batch % 3]!, tutorRng)
    anchorRuntime = freshRuntime(model, tutorRng)
  }
  const { results, anchorRuntime: nextAnchor } = practiceBatch(model, readout, practiceOptimizer, baseline, players, rng,
    { runtime: anchorRuntime, teacher: tutorPhrase(tutor, tutorRng), presetId: tutor.presetId }, LEARNING_CONFIGURATION.practiceRate, repertoire)
  anchorRuntime = nextAnchor!
  players = players.map((player, index) => {
    const result = results[index]!
    running += result.critic.total
    runningCount++
    return rng.float() < 0.15
      ? { runtime: freshRuntime(model, rng), presetId: presets[(index + batch) % 3]!, previous: [] }
      : { runtime: result.runtime, presetId: player.presetId, previous: [...player.previous, result.performance.actions].slice(-4) }
  })
  if (batch % 100 === 0) {
    const bananas = Math.round(running / runningCount * 100) / 10
    history.push({ stage: 'practice', phrases: prior.practicePhrases + batch * batchSize, bananas })
    log(`practice ${batch}/${practiceBatches} bananas while practicing ${bananas}`)
    running = 0
    runningCount = 0
  }
}

// Round trip through the shipped encoding before measuring, so the report describes the shipped fly.
const width = readoutWidth(model)
const encoded = encodeReadout(readout, width)
const shipped = decodeReadout(encoded, model)
const vocabulary = tutorVocabulary()
const measure = (weights: Float32Array, temperature: number) => measurePlay(flyPlayer(model, weights, temperature), evalSessions, 4, vocabulary)
const report = {
  connectivity, modelSeed: model.seed, brainConfiguration: BRAIN_CONFIGURATION, learning: LEARNING_CONFIGURATION,
  budget: { schoolLessons, practiceBatches, batchSize, practicePhrases: practiceBatches * batchSize },
  evaluation: { sessions: evalSessions, phrasesPerSession: 4, presets },
  environment: { node: process.version, cpu: cpus()[0]?.model ?? 'unknown' },
  seconds: Math.round((performance.now() - started) / 1000),
  results: {
    tutor: measurePlay(tutorPlayer(), evalSessions, 4, vocabulary),
    untrained: measure(createReadout(model), 1),
    schoolT1: measure(afterSchool, 1),
    schoolT08: measure(afterSchool, 0.8),
    shippedT1: measure(shipped, 1),
    shippedT08: measure(shipped, 0.8),
    shippedT06: measure(shipped, 0.6),
    shippedGreedy: measure(shipped, 0),
  } satisfies Record<string, PlayMeasurement>,
  history,
}
for (const [name, result] of Object.entries(report.results)) {
  log(`${name.padEnd(14)} bananas ${(result.total * 10).toFixed(2)} distinct ${(result.distinctPhrases * 100).toFixed(0)}% progressions ${result.progressions} original d/b/l ${(result.originality.drums * 100).toFixed(0)}/${(result.originality.bass * 100).toFixed(0)}/${(result.originality.lead * 100).toFixed(0)}% ${Object.entries(result.parts).map(([part, value]) => `${part}:${value.toFixed(2)}`).join(' ')}`)
}

const artifacts = new URL('../../artifacts/brain/', import.meta.url)
await mkdir(artifacts, { recursive: true })
const write = async (directory: URL, name: string, data: string | Uint8Array) => {
  const temporary = new URL(`${name}.tmp`, directory)
  await writeFile(temporary, data)
  await rename(temporary, new URL(name, directory))
}
await write(artifacts, `report-${tag}.json`, JSON.stringify(report, null, 2) + '\n')
await write(artifacts, `readout-${tag}.bin`, encoded)

if (values.publish) {
  if (connectivity !== 'anatomical') throw new Error('Only the anatomical fly is published')
  const directory = new URL('../../public/data/brains/fly-v1/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const compressed = gzipSync(encoded, { level: 9 })
  const checkpoint: BrainCheckpoint = {
    ...checkpointMetadata(model, {
      schoolLessons: prior.schoolLessons + schoolLessons, practicePhrases: prior.practicePhrases + practiceBatches * batchSize,
      listeningPhrases: 0, bananasFromListeners: 0,
    }, history.slice(-400), new Date().toISOString()),
    readout: { encoding: 'int8-row-scaled-v1', file: 'readout.bin.gzip', bytes: compressed.byteLength, sha256: createHash('sha256').update(compressed).digest('hex') },
  }
  await write(directory, 'readout.bin.gzip', compressed)
  await write(directory, 'checkpoint.json', JSON.stringify(checkpoint, null, 2) + '\n')
  log(`published ${compressed.byteLength} bytes to public/data/brains/fly-v1/`)
}
log('done')
