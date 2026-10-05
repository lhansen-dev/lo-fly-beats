import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { cpus } from 'node:os'
import { fileURLToPath } from 'node:url'
import { loadCircuit } from '../../src/connectome/load'
import { buildPhrasePlan, renderPhrasePlan } from '../../src/music/compose'
import { CURRICULUM_VERSION, originalContexts, teachingContexts, TEACHING_EXAMPLES, TRAINING_CONFIGURATION } from '../../src/music/learning/curriculum'
import { connectivityControl, inferReadout, meanMetrics, measureMusic, twoBarSequences, type MusicalMetrics } from '../../src/music/learning/evaluate'
import { buildReservoirGraph } from '../../src/music/learning/graph'
import { createReservoirModel } from '../../src/music/learning/reservoir'
import { commitPhrase, createLearningSnapshot, freshRuntime, preparePhrase } from '../../src/music/learning/session'
import { acceptTrainingCandidate, createTrainingOperation, measureDecoder, type TrainingResult } from '../../src/music/learning/train'
import { DECODER_CONFIGURATION, RESERVOIR_CONFIGURATION } from '../../src/music/learning/versions'
import { PRESETS } from '../../src/presets/presets'
import type { PhrasePlan, PhraseScore } from '../../src/music/types'
import fixtures from '../../tests/fixtures/learning/contexts.json'

const started = performance.now()
const localFetch: typeof fetch = async input => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const bytes = await readFile(fileURLToPath(url))
  return new Response(new Uint8Array(bytes))
}
const base = new URL('../../public/', import.meta.url).href
const [accompaniment, circuit] = await Promise.all([loadCircuit(base, localFetch), loadCircuit(base, localFetch, 'mbon-v1')])
const model = createReservoirModel(buildReservoirGraph(circuit))
const zero = connectivityControl(model, 'zero')
const permuted = connectivityControl(model, 'source-permuted')
const output = new URL('../../artifacts/learning/', import.meta.url)
await mkdir(output, { recursive: true })
async function writeArtifact(name: string, value: unknown): Promise<void> {
  const temporary = new URL(`${name}.tmp`, output)
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n')
  await rename(temporary, new URL(name, output))
}
const plans = (seeds: readonly number[], variation: number, phraseIndices: readonly number[] = [0]) =>
  Object.values(PRESETS).flatMap(preset => seeds.flatMap(sessionSeed => phraseIndices.map(phraseIndex =>
    buildPhrasePlan(accompaniment, { recipeVersion: 1, presetId: preset.id, sessionSeed, variation, tempoBpm: preset.tempoBpm }, phraseIndex))))
const training = teachingContexts(plans(fixtures.trainingSeeds, 1, fixtures.trainingPhraseIndices))
const validation = originalContexts(plans(fixtures.validationSeeds, 1))
const conditions = [
  { id: 'legacy', model, features: 'reservoir' as const, train: false },
  { id: 'untrained', model, features: 'reservoir' as const, train: false },
  { id: 'trained-frozen', model, features: 'reservoir' as const, train: true },
  { id: 'context-only', model, features: 'context-only' as const, train: true },
  { id: 'zero-connectivity', model: zero.model, features: 'reservoir' as const, train: true },
  { id: 'source-permuted', model: permuted.model, features: 'reservoir' as const, train: true },
]
const target = TEACHING_EXAMPLES[0]!.cells
const modelHash = (fixed: typeof model) => createHash('sha256').update(JSON.stringify({ incoming: fixed.graph.incoming, inputWeights: fixed.inputWeights })).digest('hex')
const conditionReports = []
let trainedPassed = false
let totalConstraintViolations = 0
for (const condition of conditions) {
  const fixedModelHash = modelHash(condition.model)
  let initial = createLearningSnapshot(accompaniment.checksum, condition.model)
  let trained: TrainingResult | null = null
  const trainingStart = performance.now()
  if (condition.train) {
    const operation = createTrainingOperation(condition.model, initial.parameters, training, validation, { features: condition.features })
    while (!operation.advance().done) { /* Each synchronous chunk has its own update and beat bounds. */ }
    trained = operation.result()!
    if (trained.status !== 'accepted') throw new Error(`${condition.id}: ${trained.reason}`)
    if (condition.features === 'reservoir') {
      const parameters = acceptTrainingCandidate(initial.parameters, trained)
      if (!parameters) throw new Error(`Rejected finite ${condition.id} candidate`)
      initial = { ...initial, parameters }
    }
    console.info(`${condition.id}: ${trained.updates} updates, validation error ${trained.before.crossEntropy.toFixed(4)} -> ${trained.after!.crossEntropy.toFixed(4)}`)
  }
  const trainingMs = performance.now() - trainingStart
  const frozenWeights = JSON.stringify(initial.parameters.decoderWeights)
  const controlWeights = trained?.decoderWeights ?? initial.parameters.decoderWeights
  const frozenControlWeights = JSON.stringify(controlWeights)
  const heldOut = originalContexts(plans(fixtures.heldOutSeeds, 0))
  const heldOutMeasurement = condition.id === 'legacy' ? null : measureDecoder(condition.model, controlWeights, heldOut, condition.features)
  const heldOutBefore = condition.train ? measureDecoder(condition.model,
    Array<number>(controlWeights.length).fill(0), heldOut, condition.features) : heldOutMeasurement
  const bundles: { mode: string; seed: number; preset: string; score: PhraseScore }[] = []
  const byPreset = []
  for (const preset of Object.values(PRESETS)) {
    const greedyMetrics: MusicalMetrics[] = []
    const variationMetrics: MusicalMetrics[] = []
    const sequencesPerSeed: number[] = []
    for (const sessionSeed of fixtures.heldOutSeeds) {
      const makePlan = (variation: number, phraseIndex: number) => buildPhrasePlan(accompaniment,
        { recipeVersion: 1, presetId: preset.id, sessionSeed, variation, tempoBpm: preset.tempoBpm }, phraseIndex)
      let snapshot = initial
      let controlRuntime = freshRuntime(condition.model.graph.neuronIds.length)
      const predict = (plan: PhrasePlan) => {
        if (condition.id === 'legacy') return { cells: plan.bassCells.map(cell => cell ?? 'rest'), score: renderPhrasePlan(plan) }
        if (condition.features === 'context-only') {
          const prediction = inferReadout(plan, condition.model, controlWeights, 'context-only', controlRuntime)
          controlRuntime = prediction.runtime
          return prediction
        }
        const prepared = preparePhrase(plan, snapshot, condition.model)
        const adopted = commitPhrase(prepared, snapshot, prepared.requestId)
        if (!adopted) throw new Error('Frozen evaluation adoption failed')
        snapshot = adopted.nextSnapshot
        return { cells: prepared.score.learning!.bassDecisions.map(decision => decision.cellId), score: prepared.score }
      }
      const greedyPlan = makePlan(0, 0)
      const greedy = predict(greedyPlan)
      greedyMetrics.push(measureMusic(greedyPlan, greedy.score, greedy.cells, target))
      bundles.push({ mode: 'greedy', seed: sessionSeed, preset: preset.id, score: greedy.score })
      snapshot = initial
      controlRuntime = freshRuntime(condition.model.graph.neuronIds.length)
      const sequences: string[] = []
      for (let phraseIndex = 0; phraseIndex < fixtures.variationPhraseCount; phraseIndex++) {
        const plan = makePlan(1, phraseIndex)
        const prediction = predict(plan)
        variationMetrics.push(measureMusic(plan, prediction.score, prediction.cells, target))
        sequences.push(...twoBarSequences(plan, prediction.cells, target))
        if (sessionSeed === fixtures.heldOutSeeds[0]) bundles.push({ mode: 'variation', seed: sessionSeed, preset: preset.id, score: prediction.score })
      }
      sequencesPerSeed.push(new Set(sequences).size)
    }
    const greedy = meanMetrics(greedyMetrics)
    const variation = meanMetrics(variationMetrics)
    byPreset.push({ preset: preset.id, greedy, variation, minDistinctSequencesOverTenPhrases: Math.min(...sequencesPerSeed), sequencesPerSeed })
  }
  if (JSON.stringify(initial.parameters.decoderWeights) !== frozenWeights || JSON.stringify(controlWeights) !== frozenControlWeights) throw new Error('Frozen evaluation changed readout weights')
  if (modelHash(condition.model) !== fixedModelHash) throw new Error('Training/evaluation changed internal or input weights')
  const greedy = meanMetrics(byPreset.map(preset => preset.greedy))
  const variation = meanMetrics(byPreset.map(preset => preset.variation))
  const minDiversity = Math.min(...byPreset.map(preset => preset.minDistinctSequencesOverTenPhrases))
  const passed = greedy.actionAccuracy >= 0.8 && variation.actionAccuracy >= 0.6 && minDiversity >= 2
    && greedy.constraintViolations === 0 && variation.constraintViolations === 0
    && !!heldOutMeasurement && !!heldOutBefore && heldOutMeasurement.crossEntropy < heldOutBefore.crossEntropy
  if (condition.id === 'trained-frozen') trainedPassed = passed
  conditionReports.push({ condition: condition.id, featureSource: condition.features, graphIdentity: condition.model.graph.checksum,
    training: trained, trainingMs, fixedInternalAndInputWeightHash: fixedModelHash, heldOutBefore, heldOutAfter: heldOutMeasurement,
    greedy, variation, minDistinctSequencesOverTenPhrases: minDiversity, byPreset, retentionTargetsPassed: passed })
  totalConstraintViolations += greedy.constraintViolations + variation.constraintViolations
  await writeArtifact(`scores-${condition.id}.json`, bundles)
  console.info(`${condition.id}: greedy ${(100 * greedy.actionAccuracy).toFixed(2)}%, full variation ${(100 * variation.actionAccuracy).toFixed(2)}%, constraints ${greedy.constraintViolations + variation.constraintViolations}`)
}
const report = { experimentVersion: 1, curriculumVersion: CURRICULUM_VERSION, trainingConfiguration: TRAINING_CONFIGURATION,
  reservoirConfiguration: RESERVOIR_CONFIGURATION, decoderConfiguration: DECODER_CONFIGURATION,
  fixtures, graphs: { accompaniment: accompaniment.checksum, reservoir: model.graph.checksum }, modelSeed: model.modelSeed,
  controls: { sourcePermutation: permuted.sourcePermutation, note: 'Only source indices are permuted; target rows, row lengths, weights, counts and input weights remain fixed. Zero connectivity retains leak and input weights.' },
  environment: { cpu: cpus()[0]?.model, node: process.version }, elapsedMs: performance.now() - started,
  conditions: conditionReports, trainedRetentionTargetsPassed: trainedPassed, listeningReview: 'Pending; no automated metric establishes listening quality.' }
await writeArtifact('report.json', report)
console.info(`Report and captured scores: ${fileURLToPath(output)}`)
if (!trainedPassed || totalConstraintViolations) {
  console.error('Frozen trained decoder missed session 3 targets; retain this report before tuning.')
  process.exitCode = 1
}
