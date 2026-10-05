import { renderPhrasePlan } from '../compose'
import type { PhrasePlan } from '../types'
import { MAPPING_VERSION } from '../versions'
import {
  advanceContext, BASS_VOCABULARY, musicalContext,
} from './context'
import { createDecoderWeights, decodeBassAction } from './decoder'
import { stepReservoir, type ReservoirModel } from './reservoir'
import {
  INPUT_VERSION, LEARNER_VERSION, MOTIF_HISTORY_LIMIT, RECENT_ACTION_LIMIT,
  RESERVOIR_CONFIGURATION, SNAPSHOT_VERSION, VOCABULARY_VERSION,
} from './versions'
import type {
  BassDecision, CommittedLearningPhrase, LearningRuntime, LearningSnapshot,
  MotifSummary, PreparedLearningPhrase,
} from './types'

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

function freshRuntime(reservoirSize: number, generationIndex = 0): LearningRuntime {
  return { activations: Array<number>(reservoirSize).fill(0), previousBassAction: null, generationIndex, contextBeatIndex: 0, recentActions: [] }
}

export function createLearningSnapshot(accompanimentGraphChecksum: string, model: ReservoirModel): LearningSnapshot {
  const reservoirSize = model.graph.neuronIds.length
  return freeze({
    parameters: {
      graphChecksum: model.graph.checksum, modelSeed: model.modelSeed, learnerVersion: LEARNER_VERSION,
      configuration: {
        ...RESERVOIR_CONFIGURATION, selector: 'reservoir-decoder', reservoirSize,
        recentActionLimit: RECENT_ACTION_LIMIT, motifHistoryLimit: MOTIF_HISTORY_LIMIT,
      },
      inputVersion: INPUT_VERSION, vocabularyVersion: VOCABULARY_VERSION,
      decoderWeights: createDecoderWeights(reservoirSize), trainingUpdateCount: 0, modelRevision: 0,
    },
    runtime: freshRuntime(reservoirSize), recentMotifs: [], recipeGeneration: 0, requestRevision: 0,
    compatibility: {
      snapshotVersion: SNAPSHOT_VERSION, learnerVersion: LEARNER_VERSION,
      accompanimentGraphChecksum, mappingVersion: MAPPING_VERSION,
    },
  })
}

/** Apply New beat/preset resets at the selected boundary; parameters and fly seed survive. */
export function resetLearningContext(snapshot: LearningSnapshot): LearningSnapshot {
  return freeze({
    ...structuredClone(snapshot), runtime: freshRuntime(snapshot.parameters.configuration.reservoirSize, snapshot.runtime.generationIndex),
    recipeGeneration: snapshot.recipeGeneration + 1,
  })
}

export function preparePhrase(plan: PhrasePlan, snapshot: LearningSnapshot, model: ReservoirModel): PreparedLearningPhrase {
  if (plan.graphChecksum !== snapshot.compatibility.accompanimentGraphChecksum) throw new Error('Incompatible accompaniment graph')
  const parameters = snapshot.parameters
  if (parameters.graphChecksum !== model.graph.checksum || parameters.modelSeed !== model.modelSeed
    || parameters.configuration.reservoirSize !== model.graph.neuronIds.length
    || parameters.configuration.selector !== 'reservoir-decoder'
    || parameters.learnerVersion !== LEARNER_VERSION || parameters.inputVersion !== INPUT_VERSION
    || parameters.vocabularyVersion !== VOCABULARY_VERSION
    || Object.entries(RESERVOIR_CONFIGURATION).some(([key, value]) => parameters.configuration[key as keyof typeof RESERVOIR_CONFIGURATION] !== value)) {
    throw new Error('Incompatible reservoir model')
  }
  if (parameters.decoderWeights.length !== BASS_VOCABULARY.length * (model.graph.neuronIds.length + 1)
    || parameters.decoderWeights.some(value => !Number.isFinite(value))) throw new Error('Invalid decoder weights')
  let runtime = structuredClone(snapshot.runtime)
  const decisions: BassDecision[] = []
  for (let beat = 0; beat < plan.trace.length; beat++) {
    const context = musicalContext(plan, beat, runtime)
    runtime = { ...runtime, activations: stepReservoir(model, runtime.activations, context.inputs) }
    const decision = decodeBassAction(context, runtime.activations, parameters.decoderWeights,
      plan.recipe.variation, parameters.modelSeed, runtime.generationIndex)
    decisions.push(decision)
    runtime = advanceContext(runtime, decision, snapshot.parameters.configuration.recentActionLimit)
  }
  const motifs: MotifSummary[] = []
  for (let firstBeat = 0; firstBeat < decisions.length; firstBeat += 8) {
    const motif = decisions.slice(firstBeat, firstBeat + 8)
    motifs.push({
      generationIndex: snapshot.runtime.generationIndex, firstBeat,
      cells: motif.map(decision => decision.cellId), eligibleMask: motif.map(decision => !decision.forcedRest),
    })
  }
  const requestRevision = snapshot.requestRevision + 1
  return freeze({
    requestId: [snapshot.recipeGeneration, requestRevision, snapshot.parameters.modelRevision,
      snapshot.runtime.generationIndex, plan.recipe.presetId, plan.recipe.sessionSeed,
      plan.recipe.variation, plan.phraseIndex].join('|'),
    requestRevision, recipeGeneration: snapshot.recipeGeneration, phraseIndex: plan.phraseIndex,
    parentModelRevision: snapshot.parameters.modelRevision,
    score: renderPhrasePlan(plan, {
      cells: decisions.map(decision => decision.cellId),
      provenance: {
        reservoirGraphChecksum: snapshot.parameters.graphChecksum, learnerVersion: snapshot.parameters.learnerVersion,
        modelRevision: snapshot.parameters.modelRevision, selector: snapshot.parameters.configuration.selector,
        bassDecisions: decisions,
      },
    }),
    startingSnapshot: structuredClone(snapshot),
    endingRuntime: { ...runtime, generationIndex: snapshot.runtime.generationIndex + 1 },
    endingMotifs: [...structuredClone(snapshot.recentMotifs), ...motifs].slice(-snapshot.parameters.configuration.motifHistoryLimit),
  })
}

/** Pure adoption gate. The caller owns the expected parent; preparation never changes it. */
export function commitPhrase(result: PreparedLearningPhrase, expected: LearningSnapshot, expectedRequestId: string): CommittedLearningPhrase | null {
  if (result.requestId !== expectedRequestId
    || result.parentModelRevision !== expected.parameters.modelRevision
    || result.recipeGeneration !== expected.recipeGeneration
    || result.requestRevision !== expected.requestRevision + 1
    || result.startingSnapshot.runtime.generationIndex !== expected.runtime.generationIndex
    || JSON.stringify(result.startingSnapshot) !== JSON.stringify(expected)) return null
  return freeze({
    score: result.score, startingSnapshot: result.startingSnapshot,
    nextSnapshot: {
      ...result.startingSnapshot, runtime: result.endingRuntime, recentMotifs: result.endingMotifs,
      requestRevision: result.requestRevision,
    },
  })
}
