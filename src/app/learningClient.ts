import type { PreparedScoreProvider } from '../audio/sequencer'
import type { CircuitGraph } from '../connectome/types'
import { buildPhrasePlan } from '../music/compose'
import { commitPhrase, phraseInput, renderPreparedBass, resetLearningContext } from '../music/learning/session'
import { acceptTrainingCandidate } from '../music/learning/train'
import type { CommittedLearningPhrase, LearningParameters, LearningSnapshot } from '../music/learning/types'
import type { LearningWorkerPort, LearningWorkerRequest, LearningWorkerResponse, WorkerIdentity } from '../music/learning/workerProtocol'
import type { PhraseScore, SessionRecipe } from '../music/types'
import { getPreset, PRESETS } from '../presets/presets'
import { validateCheckpoint, type LearningCheckpoint, type LearningCheckpointStore } from './learningPersistence'

export interface LearningStatus {
  status: 'loading' | 'ready' | 'teaching' | 'pending' | 'error'
  message: string
  checkpoint: string
  modelRevision: number
  trainingUpdateCount: number
  generationIndex: number
}
export interface LearningDiagnostics {
  workers: number
  readyScores: number
  pendingPreparations: number
  pendingTeaching: number
  fallbackCount: number
  recentActions: number
  recentMotifs: number
  inferenceMs: number
  trainingMs: number
  preparationsMeasured: number
  preparationMs: number
  p95PreparationMs: number
  planningMs: number
  workerRoundTripMs: number
  renderingMs: number
}
interface Forecast {
  recipe: SessionRecipe
  phraseIndex: number
  parent: LearningSnapshot
  generation: number
  resetContext: boolean
}
interface ReadyPhrase {
  forecast: Forecast
  committed: CommittedLearningPhrase
}
const recipeKey = (recipe: SessionRecipe) => `${recipe.presetId}|${recipe.sessionSeed}|${recipe.variation}`
const matches = (forecast: Forecast, recipe: SessionRecipe, index: number) =>
  recipeKey(forecast.recipe) === recipeKey(recipe) && forecast.phraseIndex === index

export class LearningClient implements PreparedScoreProvider {
  private readonly worker: LearningWorkerPort
  private readonly graph: CircuitGraph
  private readonly persistence: LearningCheckpointStore
  private readonly onStatus: (status: LearningStatus) => void
  private root: LearningSnapshot | null = null
  private active: CommittedLearningPhrase | null = null
  private ready: ReadyPhrase | null = null
  private forecast: Forecast | null = null
  private candidate: LearningParameters | null = null
  private generation = 0
  private sequence = 0
  private preparation: string | null = null
  private teaching: WorkerIdentity | null = null
  private cancelledTeaching: string | null = null
  private failed = false
  private disposed = false
  private queued = false
  private initialIndex = 0
  private fallbackCount = 0
  private inferenceMs = 0
  private trainingMs = 0
  private preparationTimes: number[] = []
  private preparationCount = 0
  private lastTiming = { planningMs: 0, workerRoundTripMs: 0, renderingMs: 0 }
  private checkpointStatus = 'No saved checkpoint yet.'
  private status: LearningStatus['status'] = 'loading'
  private message = 'Loading the learning worker…'
  private waiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = []
  private pending = new Map<string, {
    identity: WorkerIdentity
    resolve: (response: LearningWorkerResponse) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

  constructor(options: {
    graph: CircuitGraph; persistence: LearningCheckpointStore; onStatus: (status: LearningStatus) => void
    worker?: LearningWorkerPort
  }) {
    this.graph = options.graph
    this.persistence = options.persistence
    this.onStatus = options.onStatus
    this.worker = options.worker ?? new Worker(new URL('../music/learning/worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = event => this.receive(event.data)
    this.worker.onerror = event => { event.preventDefault(); this.fail(event.message || 'Learning worker failed') }
    this.worker.onmessageerror = () => this.fail('Could not read a learning worker response')
  }

  get initialPhraseIndex(): number { return this.initialIndex }
  get scoresHeld(): number { return Number(this.active !== null) + Number(this.ready !== null) }

  async initialize(recipe: SessionRecipe, baseUrl: string): Promise<{ recipe: SessionRecipe; restored: boolean }> {
    this.publish()
    const response = await this.send({ type: 'initialize', baseUrl, accompanimentChecksum: this.graph.checksum }, 0)
    if (response.type !== 'initialized') throw new Error('Unexpected initialization response')
    this.root = response.snapshot
    let restored = false
    try {
      const checkpoints = await this.persistence.read()
      const current = validateCheckpoint(checkpoints.current, this.root)
      const previous = validateCheckpoint(checkpoints.previous, this.root)
      const checkpoint = current ?? previous
      if (checkpoint) {
        const restoredResponse = await this.send({ type: 'restore', snapshot: checkpoint.snapshot }, checkpoint.snapshot.parameters.modelRevision)
        if (restoredResponse.type !== 'restored') throw new Error('Unexpected restore response')
        this.root = restoredResponse.snapshot
        this.initialIndex = checkpoint.phraseIndex
        recipe = checkpoint.recipe
        restored = true
        this.checkpointStatus = current ? 'Restored the current checkpoint; playback is paused.' : 'Recovered the previous compatible checkpoint; playback is paused.'
      } else this.checkpointStatus = checkpoints.current !== undefined || checkpoints.previous !== undefined
        ? 'Saved checkpoints were invalid or incompatible; initialized a fresh fly.' : 'Initialized a fresh fly; no saved checkpoint.'
    } catch (error) {
      if (this.failed) throw error
      this.checkpointStatus = `Checkpoint storage unavailable; learning continues in memory. ${error instanceof Error ? error.message : String(error)}`
    }
    this.update(recipe, this.initialIndex)
    await this.ensureReady(recipe, this.initialIndex)
    return { recipe, restored }
  }

  private tag(parentModelRevision: number): WorkerIdentity {
    return { requestId: `learning-${++this.sequence}`, recipeGeneration: this.generation, parentModelRevision }
  }

  private send(body: Omit<Extract<LearningWorkerRequest, { type: 'initialize' }>, keyof WorkerIdentity>
    | Omit<Extract<LearningWorkerRequest, { type: 'restore' }>, keyof WorkerIdentity>
    | Omit<Extract<LearningWorkerRequest, { type: 'prepare' }>, keyof WorkerIdentity>
    | Omit<Extract<LearningWorkerRequest, { type: 'teach' }>, keyof WorkerIdentity>, revision: number, tag = this.tag(revision)): Promise<LearningWorkerResponse> {
    if (this.failed || this.disposed) return Promise.reject(new Error('Learning worker is unavailable'))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail('Learning worker timed out'), 30_000)
      this.pending.set(tag.requestId, { identity: tag, resolve, reject, timer })
      try { this.worker.postMessage({ ...body, ...tag } as LearningWorkerRequest) }
      catch (error) { this.fail(error instanceof Error ? error.message : String(error)) }
    })
  }

  private receive(response: LearningWorkerResponse): void {
    const pending = this.pending.get(response.requestId)
    if (!pending || response.recipeGeneration !== pending.identity.recipeGeneration
      || response.parentModelRevision !== pending.identity.parentModelRevision) return
    clearTimeout(pending.timer)
    this.pending.delete(response.requestId)
    if (response.type === 'error') pending.reject(new Error(response.message))
    else pending.resolve(response)
  }

  private parent(): LearningSnapshot {
    return this.active?.nextSnapshot ?? this.root!
  }

  update(recipe: SessionRecipe, phraseIndex: number, resetContext = false): void {
    if (!this.root || this.disposed || this.failed) return
    if (this.forecast && matches(this.forecast, recipe, phraseIndex) && !resetContext) {
      this.forecast.recipe = recipe
      return
    }
    this.generation++
    this.cancelOperation()
    this.candidate = null
    this.ready = null
    // Later variation/tempo requests must retain a queued New beat/preset reset.
    const retainingReset = !resetContext && this.forecast?.resetContext
    const parent = resetContext ? resetLearningContext(this.parent()) : retainingReset ? this.forecast!.parent : this.parent()
    this.forecast = { recipe: { ...recipe }, phraseIndex, parent, generation: this.generation, resetContext: resetContext || !!retainingReset }
    this.queuePreparation()
  }

  reset(recipe: SessionRecipe): void {
    if (!this.root || this.failed || this.disposed) return
    this.root = resetLearningContext(this.parent())
    this.active = null
    this.forecast = null
    this.initialIndex = 0
    this.update(recipe, 0)
  }

  async ensureReady(recipe: SessionRecipe, phraseIndex: number): Promise<void> {
    if (this.failed || this.disposed) throw new Error(this.message)
    this.update(recipe, phraseIndex)
    if (this.ready && matches(this.ready.forecast, recipe, phraseIndex)) return
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }

  /** Called by audio scheduling: consume pointers only; deferred work builds plans/saves. */
  take(recipe: SessionRecipe, phraseIndex: number): PhraseScore {
    const ready = this.ready
    let checkpoint: LearningCheckpoint | null = null
    if (ready && ready.forecast.generation === this.generation && matches(ready.forecast, recipe, phraseIndex)) {
      this.active = ready.committed
      this.root = ready.committed.startingSnapshot
      this.ready = null
      this.candidate = null
      checkpoint = this.checkpoint(recipe, phraseIndex, this.active.startingSnapshot)
      this.forecast = { recipe, phraseIndex: phraseIndex + 1, parent: this.active.nextSnapshot, generation: this.generation, resetContext: false }
    } else {
      if (!this.active) throw new Error('The first learning score must be ready before playback')
      this.fallbackCount++
      this.generation++
      this.ready = null
      // Freeze progress and invalidate every forecast for the missed timeline.
      this.forecast = { recipe, phraseIndex: phraseIndex + 1, parent: this.active.startingSnapshot,
        generation: this.generation, resetContext: this.forecast?.resetContext ?? false }
    }
    const fallback = checkpoint === null
    queueMicrotask(() => {
      if (this.disposed) return
      if (fallback) {
        if (this.forecast?.resetContext) this.forecast.parent = resetLearningContext(this.forecast.parent)
        if (!this.failed) this.setStatus('pending', 'Preparation missed its boundary; repeating the current score with model progress frozen.')
      } else {
        this.setStatus(this.teaching ? 'teaching' : 'ready', 'Learning phrase adopted; decoder weights stay fixed during playback.')
        void this.save(checkpoint!)
      }
      this.queuePreparation()
    })
    return this.active!.score
  }

  private queuePreparation(): void {
    if (this.queued || this.disposed || this.failed) return
    this.queued = true
    queueMicrotask(() => {
      this.queued = false
      void this.prepare()
    })
  }

  private async prepare(): Promise<void> {
    if (this.preparation || this.ready || !this.forecast || this.disposed || this.failed) return
    const forecast = this.forecast
    const parameters = this.candidate
    const parent = parameters ? { ...forecast.parent, parameters } : forecast.parent
    const tag = this.tag(parent.parameters.modelRevision)
    this.preparation = tag.requestId
    const started = performance.now()
    try {
      // Full CNS traversal and immutable score rendering both happen outside onStep.
      const plan = buildPhrasePlan(this.graph, forecast.recipe, forecast.phraseIndex)
      const planned = performance.now()
      const response = await this.send({ type: 'prepare', input: phraseInput(plan), snapshot: parent }, parent.parameters.modelRevision, tag)
      const received = performance.now()
      if (this.disposed || this.failed || this.forecast !== forecast || forecast.generation !== this.generation
        || parameters !== this.candidate) return
      if (response.type !== 'prepared') throw new Error('Unexpected preparation response')
      const prepared = renderPreparedBass(plan, response.bass)
      const committed = commitPhrase(prepared, parent, prepared.requestId)
      if (!committed) throw new Error('Worker returned a stale preparation')
      this.lastTiming = { planningMs: planned - started, workerRoundTripMs: received - planned, renderingMs: performance.now() - received }
      this.preparationTimes = [...this.preparationTimes, performance.now() - started].slice(-64)
      this.preparationCount++
      this.inferenceMs = response.inferenceMs
      this.ready = { forecast, committed }
      if (!this.active && parameters) {
        this.root = committed.startingSnapshot
        this.candidate = null
        void this.save(this.checkpoint(forecast.recipe, forecast.phraseIndex, this.root))
      }
      this.setStatus(this.teaching ? 'teaching' : parameters && this.active ? 'pending' : 'ready',
        parameters && this.active ? 'Taught candidate is ready for the next phrase boundary.' : 'Learning score ready; playback preserves the current phrase.')
      for (const waiter of this.waiters.splice(0)) waiter.resolve()
    } catch (error) { this.fail(error instanceof Error ? error.message : String(error)) }
    finally {
      this.preparation = null
      if (!this.ready) this.queuePreparation()
    }
  }

  teach(): void {
    if (!this.root || this.teaching || this.candidate || this.failed || this.disposed || !this.forecast) return
    const parameters = this.parent().parameters
    const tag = this.tag(parameters.modelRevision)
    this.teaching = tag
    this.cancelledTeaching = null
    this.setStatus('teaching', 'Teaching a candidate decoder; listening memory is preserved.')
    void (async () => {
      try {
        const recipe = this.forecast!.recipe
        const plans = (seeds: number[], indices = [0]) => Object.values(PRESETS).flatMap(preset =>
          seeds.flatMap(sessionSeed => indices.map(index => phraseInput(buildPhrasePlan(this.graph,
            { ...recipe, presetId: preset.id, sessionSeed, variation: 1 }, index)))))
        const response = await this.send({ type: 'teach', parameters,
          training: plans(Array.from({ length: 12 }, (_, i) => i + 1), [0, 1]), validation: plans([1001, 1002, 1003, 1004]) }, parameters.modelRevision, tag)
        if (this.disposed || this.failed || this.teaching !== tag || tag.recipeGeneration !== this.generation) return
        if (this.cancelledTeaching === tag.requestId) {
          this.setStatus('ready', 'Teaching cancelled; live parameters preserved.')
          return
        }
        if (response.type !== 'taught') throw new Error('Unexpected teaching response')
        this.trainingMs = response.trainingMs
        this.candidate = acceptTrainingCandidate(this.parent().parameters, response.candidate)
        if (!this.candidate) {
          this.setStatus('ready', `Teaching was not adopted: ${response.candidate.reason ?? 'stale candidate'}.`)
          return
        }
        // Drop the old next score before preparing its replacement: retain at most two.
        this.ready = null
        this.setStatus('pending', 'Teaching finished; preparing a replacement before boundary adoption.')
        this.queuePreparation()
      } catch (error) { this.fail(error instanceof Error ? error.message : String(error)) }
      finally {
        if (this.teaching === tag) {
          this.teaching = null
          if (tag.recipeGeneration !== this.generation && this.status === 'teaching') {
            this.setStatus(this.ready ? 'ready' : 'pending', 'Stale teaching was discarded; listening parameters are preserved.')
          } else this.publish()
        }
      }
    })()
  }

  cancelTeaching(): void {
    const replacing = this.candidate !== null
    this.cancelOperation()
    if (replacing) {
      this.ready = null
      this.queuePreparation()
    }
    if (!this.failed && !this.disposed) this.setStatus('ready', 'Teaching cancelled; live parameters preserved.')
  }

  private cancelOperation(): void {
    this.candidate = null
    if (this.teaching) {
      const tag = this.teaching
      this.cancelledTeaching = tag.requestId
      // Keep the pending slot until the worker acknowledges cancellation.
      try { this.worker.postMessage({ type: 'cancel', ...tag }) }
      catch (error) { this.fail(error instanceof Error ? error.message : String(error)) }
    }
  }

  private checkpoint(recipe: SessionRecipe, phraseIndex: number, snapshot: LearningSnapshot): LearningCheckpoint {
    return { checkpointVersion: 1, presetVersion: getPreset(recipe.presetId).version, recipe: { ...recipe }, phraseIndex, snapshot }
  }

  private async save(checkpoint: LearningCheckpoint): Promise<void> {
    try {
      await this.persistence.save(checkpoint)
      this.checkpointStatus = 'Committed boundary saved.'
    } catch (error) {
      this.checkpointStatus = `Checkpoint save failed; learning continues in memory. ${error instanceof Error ? error.message : String(error)}`
    }
    if (!this.disposed) this.publish()
  }

  private setStatus(status: LearningStatus['status'], message: string): void {
    this.status = status
    this.message = message
    this.publish()
  }
  private publish(): void {
    const snapshot = this.active?.startingSnapshot ?? this.root
    this.onStatus({ status: this.status, message: this.message, checkpoint: this.checkpointStatus,
      modelRevision: snapshot?.parameters.modelRevision ?? 0, trainingUpdateCount: snapshot?.parameters.trainingUpdateCount ?? 0,
      generationIndex: snapshot?.runtime.generationIndex ?? 0 })
  }
  private fail(message: string): void {
    if (this.failed || this.disposed) return
    this.failed = true
    this.worker.terminate()
    this.ready = null
    this.candidate = null
    this.teaching = null
    this.preparation = null
    const error = new Error(message)
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error) }
    this.pending.clear()
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
    this.setStatus('error', `Learning worker unavailable: ${message}. ${this.active ? 'The current score remains playable.' : 'The baseline player remains available.'}`)
  }
  getDiagnostics(): LearningDiagnostics {
    const snapshot = this.active?.startingSnapshot ?? this.root
    const timings = [...this.preparationTimes].sort((a, b) => a - b)
    return { workers: Number(!this.disposed && !this.failed), readyScores: this.scoresHeld,
      pendingPreparations: Number(this.preparation !== null), pendingTeaching: Number(this.teaching !== null),
      fallbackCount: this.fallbackCount, recentActions: snapshot?.runtime.recentActions.length ?? 0,
      recentMotifs: snapshot?.recentMotifs.length ?? 0, inferenceMs: this.inferenceMs, trainingMs: this.trainingMs,
      preparationsMeasured: this.preparationCount, preparationMs: this.preparationTimes.at(-1) ?? 0,
      p95PreparationMs: timings[Math.max(0, Math.ceil(0.95 * timings.length) - 1)] ?? 0, ...this.lastTiming }
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.worker.terminate()
    this.worker.onmessage = null
    this.worker.onerror = null
    this.worker.onmessageerror = null
    const error = new Error('Learning session disposed')
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error) }
    this.pending.clear()
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
    this.ready = null
    this.active = null
    this.persistence.close()
  }
}
