import { originalContexts, teachingContexts } from './curriculum'
import type { ReservoirModel } from './reservoir'
import { createLearningSnapshot, prepareBass } from './session'
import { validateLearningSnapshot } from './snapshot'
import { createTrainingOperation } from './train'
import type { LearningSnapshot } from './types'
import type { LearningWorkerRequest, LearningWorkerResponse, WorkerIdentity } from './workerProtocol'

/** A task yield between chunks lets posted preparation/cancellation run first. */
export function createLearningWorkerRuntime(
  loadModel: (baseUrl: string) => Promise<ReservoirModel>,
  emit: (response: LearningWorkerResponse) => void,
  schedule: (task: () => void) => void = task => { setTimeout(task, 0) },
) {
  let model: ReservoirModel | null = null
  let initializing = false
  let template: LearningSnapshot | null = null
  let training: { identity: WorkerIdentity; operation: ReturnType<typeof createTrainingOperation>; started: number } | null = null
  const identity = (message: WorkerIdentity): WorkerIdentity => ({
    requestId: message.requestId, recipeGeneration: message.recipeGeneration, parentModelRevision: message.parentModelRevision,
  })
  const trainChunk = (current: NonNullable<typeof training>) => {
    if (training !== current) return
    const progress = current.operation.advance()
    if (progress.done) {
      training = null
      emit({ ...current.identity, type: 'taught', candidate: current.operation.result()!, trainingMs: performance.now() - current.started })
    } else schedule(() => trainChunk(current))
  }
  return {
    async receive(message: LearningWorkerRequest): Promise<void> {
      const tag = identity(message)
      try {
        if (message.type === 'initialize') {
          if (model || initializing) throw new Error('Worker is already initialized')
          initializing = true
          model = await loadModel(message.baseUrl)
          template = createLearningSnapshot(message.accompanimentChecksum, model)
          initializing = false
          emit({ ...tag, type: 'initialized', snapshot: template })
          return
        }
        if (!model || !template) throw new Error('Learning worker is not initialized')
        if (message.type === 'cancel') {
          if (training?.identity.requestId === message.requestId) {
            const current = training
            training = null
            emit({ ...current.identity, type: 'taught', candidate: current.operation.cancel(), trainingMs: performance.now() - current.started })
          }
          return
        }
        if (message.type === 'restore' || message.type === 'prepare') {
          const snapshot = validateLearningSnapshot(message.snapshot, template)
          if (!snapshot || snapshot.parameters.modelRevision !== tag.parentModelRevision) throw new Error('Invalid or incompatible worker snapshot')
          if (message.type === 'restore') emit({ ...tag, type: 'restored', snapshot })
          else {
            const started = performance.now()
            const bass = prepareBass(message.input, snapshot, model)
            emit({ ...tag, type: 'prepared', bass, inferenceMs: performance.now() - started })
          }
          return
        }
        if (training) throw new Error('A teaching operation is already pending')
        if (message.parameters.modelRevision !== tag.parentModelRevision) throw new Error('Stale teaching parent')
        training = { identity: tag, started: performance.now(), operation: createTrainingOperation(model,
          message.parameters, teachingContexts(message.training), originalContexts(message.validation)) }
        const current = training
        schedule(() => trainChunk(current))
      } catch (error) {
        emit({ ...tag, type: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}
