import type { LearningParameters, LearningPhraseInput, LearningSnapshot, PreparedBassPhrase } from './types'
import type { TrainingResult } from './train'

export interface WorkerIdentity {
  requestId: string
  recipeGeneration: number
  parentModelRevision: number
}
export type LearningWorkerRequest = WorkerIdentity & (
  | { type: 'initialize'; baseUrl: string; accompanimentChecksum: string }
  | { type: 'restore'; snapshot: LearningSnapshot }
  | { type: 'prepare'; input: LearningPhraseInput; snapshot: LearningSnapshot }
  | { type: 'teach'; parameters: LearningParameters; training: LearningPhraseInput[]; validation: LearningPhraseInput[] }
  | { type: 'cancel' }
)
export type LearningWorkerResponse = WorkerIdentity & (
  | { type: 'initialized' | 'restored'; snapshot: LearningSnapshot }
  | { type: 'prepared'; bass: PreparedBassPhrase; inferenceMs: number }
  | { type: 'taught'; candidate: TrainingResult; trainingMs: number }
  | { type: 'error'; message: string }
)
export interface LearningWorkerPort {
  postMessage(message: LearningWorkerRequest): void
  onmessage: ((event: MessageEvent<LearningWorkerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
  terminate(): void
}
