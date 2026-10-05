import type { BassCellId } from '../patterns'
import type { PhraseScore } from '../types'

export interface LearningConfiguration {
  selector: 'deterministic-test'
  reservoirSize: number
  recentActionLimit: number
  motifHistoryLimit: number
}

export interface LearningParameters {
  /** Null until an actual reservoir graph is loaded in session 2. */
  graphChecksum: string | null
  modelSeed: number
  configuration: Readonly<LearningConfiguration>
  learnerVersion: number
  inputVersion: number
  vocabularyVersion: number
  decoderWeights: readonly number[]
  trainingUpdateCount: number
  modelRevision: number
}

export interface RecentBassAction {
  contextBeatIndex: number
  cellId: BassCellId
  forcedRest: boolean
}

export interface LearningRuntime {
  activations: readonly number[]
  previousBassAction: BassCellId | null
  /** Independent of recipe phraseIndex; New beat never rewinds it. */
  generationIndex: number
  contextBeatIndex: number
  recentActions: readonly RecentBassAction[]
}

export interface MotifSummary {
  generationIndex: number
  firstBeat: number
  cells: readonly BassCellId[]
  /** Forced silence contributes neither a teaching label nor an accuracy observation. */
  eligibleMask: readonly boolean[]
}

export interface LearningSnapshot {
  parameters: Readonly<LearningParameters>
  runtime: Readonly<LearningRuntime>
  recentMotifs: readonly MotifSummary[]
  compatibility: Readonly<{
    snapshotVersion: number
    learnerVersion: number
    accompanimentGraphChecksum: string
    mappingVersion: number
  }>
  recipeGeneration: number
  requestRevision: number
}

export interface MusicalContext {
  beat: number
  beatInBar: number
  barParity: number
  chordRingIndex: number
  previousBassAction: BassCellId | null
  traversalRest: boolean
  inputs: readonly number[]
}

export interface BassDecision {
  beat: number
  cellId: BassCellId
  probability: number
  /** Fixed vocabulary order; all false means traversal-forced silence. */
  legalActionMask: readonly boolean[]
  forcedRest: boolean
}

export interface LearningProvenance {
  reservoirGraphChecksum: string | null
  learnerVersion: number
  modelRevision: number
  selector: LearningConfiguration['selector']
  bassDecisions: readonly BassDecision[]
}

export interface PreparedLearningPhrase {
  requestId: string
  requestRevision: number
  recipeGeneration: number
  phraseIndex: number
  parentModelRevision: number
  score: PhraseScore
  /** The boundary state to retain when adopting this score, including for restart. */
  startingSnapshot: LearningSnapshot
  endingRuntime: Readonly<LearningRuntime>
  endingMotifs: readonly MotifSummary[]
}

export interface CommittedLearningPhrase {
  score: PhraseScore
  startingSnapshot: LearningSnapshot
  /** Speculative parent for the next preparation, never a boundary checkpoint. */
  nextSnapshot: LearningSnapshot
}
