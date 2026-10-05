import { renderPhrasePlan } from '../compose'
import { clamp } from '../math'
import { createRng, type Rng } from '../rng'
import type { PhrasePlan } from '../types'
import { MAPPING_VERSION } from '../versions'
import {
  advanceContext, BASS_VOCABULARY, INPUT_VERSION, LEARNER_VERSION, legalBassActions,
  MOTIF_HISTORY_LIMIT, musicalContext, RECENT_ACTION_LIMIT, SNAPSHOT_VERSION, VOCABULARY_VERSION,
} from './context'
import type {
  BassDecision, CommittedLearningPhrase, LearningRuntime, LearningSnapshot,
  MotifSummary, MusicalContext, PreparedLearningPhrase,
} from './types'

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

export function learningRng(modelSeed: number, generationIndex: number, purpose: string): Rng {
  return createRng(`learning|${LEARNER_VERSION}|${modelSeed}|${generationIndex}|${purpose}`)
}

function freshRuntime(generationIndex = 0): LearningRuntime {
  return { activations: [], previousBassAction: null, generationIndex, contextBeatIndex: 0, recentActions: [] }
}

export function createLearningSnapshot(accompanimentGraphChecksum: string, modelSeed = 1): LearningSnapshot {
  return freeze({
    parameters: {
      graphChecksum: null, modelSeed, learnerVersion: LEARNER_VERSION,
      configuration: {
        selector: 'deterministic-test', reservoirSize: 0,
        recentActionLimit: RECENT_ACTION_LIMIT, motifHistoryLimit: MOTIF_HISTORY_LIMIT,
      },
      inputVersion: INPUT_VERSION, vocabularyVersion: VOCABULARY_VERSION,
      decoderWeights: [], trainingUpdateCount: 0, modelRevision: 0,
    },
    runtime: freshRuntime(), recentMotifs: [], recipeGeneration: 0, requestRevision: 0,
    compatibility: {
      snapshotVersion: SNAPSHOT_VERSION, learnerVersion: LEARNER_VERSION,
      accompanimentGraphChecksum, mappingVersion: MAPPING_VERSION,
    },
  })
}

/** Apply New beat/preset resets at the selected boundary; parameters and fly seed survive. */
export function resetLearningContext(snapshot: LearningSnapshot): LearningSnapshot {
  return freeze({
    ...structuredClone(snapshot), runtime: freshRuntime(snapshot.runtime.generationIndex),
    recipeGeneration: snapshot.recipeGeneration + 1,
  })
}

/** A state-carrying test selector, not a trained model or a connectome simulation. */
function selectTestAction(context: MusicalContext, snapshot: LearningSnapshot, variation: number): BassDecision {
  const legalActionMask = legalBassActions(context.beatInBar, context.traversalRest)
  if (context.traversalRest) return { beat: context.beat, cellId: 'rest', probability: 1, legalActionMask, forcedRest: true }
  const legal = BASS_VOCABULARY.filter((_, index) => legalActionMask[index])
  const previousIndex = context.previousBassAction === null ? -1 : BASS_VOCABULARY.indexOf(context.previousBassAction)
  const greedyIndex = (previousIndex + 1 + context.chordRingIndex + context.barParity) % legal.length
  const exploration = 0.2 * clamp(variation, 0, 1)
  const probabilities = legal.map((_, index) => exploration / legal.length + (index === greedyIndex ? 1 - exploration : 0))
  let chosenIndex = greedyIndex
  if (exploration > 0) {
    const draw = learningRng(snapshot.parameters.modelSeed, snapshot.runtime.generationIndex, `bass-selection|${context.beat}`).float()
    let cumulative = 0
    chosenIndex = legal.length - 1
    for (let index = 0; index < legal.length; index++) {
      cumulative += probabilities[index]!
      if (draw < cumulative) { chosenIndex = index; break }
    }
  }
  return { beat: context.beat, cellId: legal[chosenIndex]!, probability: probabilities[chosenIndex]!, legalActionMask, forcedRest: false }
}

export function preparePhrase(plan: PhrasePlan, snapshot: LearningSnapshot): PreparedLearningPhrase {
  if (plan.graphChecksum !== snapshot.compatibility.accompanimentGraphChecksum) throw new Error('Incompatible accompaniment graph')
  if (snapshot.parameters.configuration.selector !== 'deterministic-test') throw new Error('Unsupported selector')
  let runtime = structuredClone(snapshot.runtime)
  const decisions: BassDecision[] = []
  for (let beat = 0; beat < plan.trace.length; beat++) {
    const context = musicalContext(plan, beat, runtime)
    const decision = selectTestAction(context, snapshot, plan.recipe.variation)
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
