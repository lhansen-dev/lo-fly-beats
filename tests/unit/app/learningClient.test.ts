import { describe, expect, it, vi } from 'vitest'
import { LearningClient, type LearningStatus } from '../../../src/app/learningClient'
import type { LearningCheckpoint, LearningCheckpointStore } from '../../../src/app/learningPersistence'
import { PlaybackSequencer } from '../../../src/audio/sequencer'
import { buildPhrasePlan } from '../../../src/music/compose'
import { originalContexts, teachingContexts } from '../../../src/music/learning/curriculum'
import { createLearningSnapshot, preparePhrase } from '../../../src/music/learning/session'
import { createTrainingOperation } from '../../../src/music/learning/train'
import { createLearningWorkerRuntime } from '../../../src/music/learning/workerRuntime'
import type { LearningWorkerPort, LearningWorkerRequest, LearningWorkerResponse } from '../../../src/music/learning/workerProtocol'
import type { SessionRecipe } from '../../../src/music/types'
import { fixtureGraph } from '../helpers/fixtureGraph'
import { learningModel } from '../music/learning/fixture'

const graph = fixtureGraph()
const model = learningModel()
const recipe: SessionRecipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, tempoBpm: 80, variation: 0.5 }
const initial = createLearningSnapshot(graph.checksum, model)
const plans = [buildPhrasePlan(graph, recipe, 0)]
const training = createTrainingOperation(model, initial.parameters, teachingContexts(plans), originalContexts(plans), { maxUpdates: 128 })
training.advance()
const candidate = training.result()!
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }

class ControlledWorker implements LearningWorkerPort {
  onmessage: LearningWorkerPort['onmessage'] = null
  onerror: LearningWorkerPort['onerror'] = null
  onmessageerror: LearningWorkerPort['onmessageerror'] = null
  terminated = 0
  requests: LearningWorkerRequest[] = []
  held: LearningWorkerRequest[] = []
  delayPreparation = false
  delayTeaching = false
  private runtime = createLearningWorkerRuntime(async () => model, response => this.reply(response))
  reply(response: LearningWorkerResponse) { this.onmessage?.({ data: structuredClone(response) } as MessageEvent<LearningWorkerResponse>) }
  postMessage(request: LearningWorkerRequest) {
    this.requests.push(structuredClone(request))
    if (request.type === 'teach') {
      if (this.delayTeaching) this.held.push(request)
      else this.reply({ ...request, type: 'taught', candidate, trainingMs: 20 })
    } else if (request.type === 'prepare' && this.delayPreparation) this.held.push(request)
    else if (request.type === 'cancel') {
      const index = this.held.findIndex(item => item.requestId === request.requestId)
      if (index >= 0) {
        this.held.splice(index, 1)
        this.reply({ ...request, type: 'taught', candidate: { ...candidate, status: 'rejected', reason: 'Teaching cancelled', decoderWeights: null }, trainingMs: 1 })
      }
    } else void this.runtime.receive(request)
  }
  release() {
    const request = this.held.shift()!
    if (request.type === 'teach') this.reply({ ...request, type: 'taught', candidate, trainingMs: 20 })
    else void this.runtime.receive(request)
  }
  terminate() { this.terminated++ }
}
class MemoryStore implements LearningCheckpointStore {
  current: unknown = undefined
  previous: unknown = undefined
  saved: LearningCheckpoint[] = []
  failure: string | null = null
  async read() { if (this.failure) throw new Error(this.failure); return { current: this.current, previous: this.previous } }
  async save(checkpoint: LearningCheckpoint) {
    if (this.failure) throw new Error(this.failure)
    this.previous = this.current
    this.current = structuredClone(checkpoint)
    this.saved.push(structuredClone(checkpoint))
  }
  close() {}
}
async function setup(persistence = new MemoryStore()) {
  const worker = new ControlledWorker()
  const statuses: LearningStatus[] = []
  const client = new LearningClient({ graph, worker, persistence, onStatus: status => statuses.push(status) })
  const initialized = await client.initialize(recipe, '/')
  return { client, worker, persistence, statuses, initialized }
}

describe('prepared playback lifecycle', () => {
  it('does no composition, worker messages, or storage work inside the boundary callback', async () => {
    const { client, worker, persistence } = await setup()
    const requestCount = worker.requests.length
    const first = client.take(recipe, 0)
    expect(first.learning).toBeDefined()
    expect(worker.requests).toHaveLength(requestCount)
    expect(persistence.saved).toHaveLength(0)
    await settle()
    expect(persistence.saved).toHaveLength(1)
    expect(persistence.saved[0]!.snapshot.runtime.generationIndex).toBe(0)
    expect(client.getDiagnostics()).toMatchObject({ workers: 1, readyScores: 2, pendingPreparations: 0, recentActions: 0 })
    const prepare = worker.requests.find(request => request.type === 'prepare')!
    expect(prepare).toHaveProperty('input.trace')
    expect(prepare).not.toHaveProperty('input.accompaniment')
    expect(prepare).not.toHaveProperty('input.bassCells')
    expect(JSON.stringify(prepare)).not.toContain('sourceIndex')
    client.dispose()
    expect(worker.terminated).toBe(1)
  })

  it('repeats a late phrase, freezes progress, rejects stale replies, and retries from the committed snapshot', async () => {
    const { client, worker, persistence } = await setup()
    worker.delayPreparation = true
    const first = client.take(recipe, 0)
    await settle()
    const missed = worker.held[0]!
    expect(client.take(recipe, 1)).toBe(first)
    await settle()
    expect(persistence.saved).toHaveLength(1)
    expect(client.getDiagnostics()).toMatchObject({ fallbackCount: 1, pendingPreparations: 1, readyScores: 1 })
    worker.release()
    await settle()
    expect(worker.held).toHaveLength(1)
    expect(worker.held[0]!.recipeGeneration).toBeGreaterThan(missed.recipeGeneration)
    const retry = worker.held[0]!
    expect(retry.type).toBe('prepare')
    if (retry.type === 'prepare') {
      expect(retry.input.phraseIndex).toBe(2)
      expect(retry.snapshot).toEqual(persistence.saved[0]!.snapshot)
    }
    worker.release()
    await settle()
    const next = client.take(recipe, 2)
    expect(next).toEqual(preparePhrase(buildPhrasePlan(graph, recipe, 2), persistence.saved[0]!.snapshot, model).score)
    await settle()
    expect(persistence.saved.at(-1)!.snapshot.runtime.generationIndex).toBe(0)
    client.dispose()
  })

  it('restores the playing boundary and follows the same runtime as uninterrupted playback', async () => {
    const original = await setup()
    original.client.take(recipe, 0)
    await settle()
    const first = original.client.take(recipe, 1)
    await settle()
    const recovered = await setup(original.persistence)
    expect(recovered.initialized.restored).toBe(true)
    expect(recovered.client.initialPhraseIndex).toBe(1)
    expect(recovered.client.take(recipe, 1)).toEqual(first)
    await settle()
    const next = original.client.take(recipe, 2)
    const recoveredNext = recovered.client.take(recipe, 2)
    expect(recoveredNext).toEqual(next)
    await settle()
    expect(original.persistence.saved.at(-1)!.snapshot.runtime.generationIndex).toBe(2)
    original.client.dispose()
    recovered.client.dispose()
  })

  it('uses the previous compatible checkpoint and initializes fresh if both are invalid', async () => {
    const first = await setup()
    first.client.take(recipe, 0)
    await settle()
    first.client.take(recipe, 1)
    await settle()
    first.persistence.current = { broken: true }
    const recovered = await setup(first.persistence)
    expect(recovered.initialized.restored).toBe(true)
    expect(recovered.statuses.at(-1)!.checkpoint).toContain('previous compatible')
    first.persistence.previous = { ...first.persistence.saved[0]!, snapshot: { ...initial, compatibility: { ...initial.compatibility, mappingVersion: 100 } } }
    const fresh = await setup(first.persistence)
    expect(fresh.initialized.restored).toBe(false)
    expect(fresh.statuses.at(-1)!.checkpoint).toContain('fresh fly')
    first.client.dispose(); recovered.client.dispose(); fresh.client.dispose()
  })

  it.each(['unavailable', 'QuotaExceededError'])('keeps inference/playback usable after %s storage', async failure => {
    const persistence = new MemoryStore()
    persistence.failure = failure
    const { client, statuses } = await setup(persistence)
    client.take(recipe, 0)
    await settle()
    expect(client.take(recipe, 1).learning).toBeDefined()
    await settle()
    expect(statuses.at(-1)!.checkpoint).toContain('continues in memory')
    expect(client.getDiagnostics().workers).toBe(1)
    client.dispose()
  })

  it('retains a usable score after worker failure, including reset while paused', async () => {
    const { client, worker, statuses } = await setup()
    const first = client.take(recipe, 0)
    await settle()
    worker.onerror!({ message: 'worker crashed', preventDefault() {} } as ErrorEvent)
    expect(statuses.at(-1)!.message).toContain('worker crashed')
    client.reset({ ...recipe, sessionSeed: 88 })
    expect(client.take({ ...recipe, sessionSeed: 88 }, 0)).toBe(first)
    await settle()
    expect(client.getDiagnostics()).toMatchObject({ workers: 0, readyScores: 1, pendingTeaching: 0, pendingPreparations: 0 })
    client.dispose()
  })
})

describe('candidate adoption and control races', () => {
  it('adopts teaching only after its replacement is ready at a boundary; paused scores remain immutable', async () => {
    const { client, worker, persistence } = await setup()
    const first = client.take(recipe, 0)
    await settle()
    worker.delayPreparation = true
    client.teach(); client.teach()
    await settle()
    expect(worker.requests.filter(request => request.type === 'teach')).toHaveLength(1)
    expect(persistence.saved).toHaveLength(1)
    expect(first.learning!.modelRevision).toBe(0)
    expect(client.getDiagnostics()).toMatchObject({ readyScores: 1, pendingPreparations: 1 })
    worker.release()
    await settle()
    expect(persistence.saved).toHaveLength(1)
    // Waiting while paused performs no adoption/save.
    await settle()
    expect(first.learning!.modelRevision).toBe(0)
    const taught = client.take(recipe, 1)
    expect(taught.learning!.modelRevision).toBe(1)
    await settle()
    expect(persistence.saved.at(-1)!.snapshot.parameters.trainingUpdateCount).toBe(128)
    expect(persistence.saved.at(-1)!.snapshot.runtime.generationIndex).toBe(1)
    client.dispose()
  })

  it('defers a completed candidate to the following boundary when its replacement is late', async () => {
    const { client, worker, persistence } = await setup()
    const first = client.take(recipe, 0)
    await settle()
    worker.delayPreparation = true
    client.teach()
    await settle()
    expect(client.take(recipe, 1)).toBe(first)
    await settle()
    worker.release() // Discard the replacement for the missed timeline.
    await settle()
    worker.release() // Prepare the candidate from the frozen committed snapshot.
    await settle()
    expect(client.take(recipe, 2).learning!.modelRevision).toBe(1)
    await settle()
    expect(persistence.saved.at(-1)!.snapshot.parameters.trainingUpdateCount).toBe(128)
    expect(persistence.saved.at(-1)!.snapshot.runtime.generationIndex).toBe(0)
    client.dispose()
  })

  it('can adopt teaching before the first played phrase and save its starting runtime', async () => {
    const { client, persistence } = await setup()
    client.teach()
    await settle()
    expect(persistence.saved.at(-1)!.snapshot.parameters.modelRevision).toBe(1)
    expect(persistence.saved.at(-1)!.snapshot.runtime.generationIndex).toBe(0)
    expect(client.take(recipe, 0).learning!.modelRevision).toBe(1)
    client.dispose()
  })

  it('cancels running or prepared teaching without duplicate updates or adoption', async () => {
    const { client, worker, persistence } = await setup()
    client.take(recipe, 0)
    await settle()
    worker.delayTeaching = true
    client.teach(); client.teach()
    client.cancelTeaching()
    await settle()
    expect(worker.requests.filter(request => request.type === 'teach')).toHaveLength(1)
    expect(client.take(recipe, 1).learning!.modelRevision).toBe(0)
    await settle()
    worker.delayTeaching = false
    client.teach()
    await settle()
    client.cancelTeaching()
    await settle()
    expect(client.take(recipe, 2).learning!.modelRevision).toBe(0)
    await settle()
    expect(persistence.saved.every(checkpoint => checkpoint.snapshot.parameters.trainingUpdateCount === 0)).toBe(true)
    client.dispose()
  })

  it('invalidates stale preparations and teaching on New beat/preset; resets preserve fly parameters and generation', async () => {
    const { client, worker, persistence } = await setup()
    client.take(recipe, 0)
    await settle()
    worker.delayTeaching = true
    client.teach()
    const changed = { ...recipe, presetId: 'overripe-2am', sessionSeed: 77 } as const
    worker.delayPreparation = true
    client.update(changed, 0, true)
    await settle()
    expect(client.getDiagnostics().pendingTeaching).toBe(0)
    const stale = worker.held[0]!
    client.reset({ ...changed, sessionSeed: 88 })
    worker.release()
    await settle()
    expect(worker.held[0]!.recipeGeneration).toBeGreaterThan(stale.recipeGeneration)
    worker.release()
    await settle()
    const resetRecipe = { ...changed, sessionSeed: 88 }
    expect(client.take(resetRecipe, 0).sessionSeed).toBe(88)
    await settle()
    const checkpoint = persistence.saved.at(-1)!
    expect(checkpoint.snapshot.parameters).toEqual(initial.parameters)
    expect(checkpoint.snapshot.runtime.generationIndex).toBe(1)
    expect(checkpoint.snapshot.runtime.previousBassAction).toBeNull()
    expect(checkpoint.snapshot.runtime.activations.every(value => value === 0)).toBe(true)
    client.dispose()
  })

  it('retains a pending context reset when variation changes again before its boundary', async () => {
    const { client, persistence } = await setup()
    client.take(recipe, 0)
    await settle()
    const changed = { ...recipe, presetId: 'overripe-2am' } as const
    client.update(changed, 1, true)
    client.update({ ...changed, variation: 0.7 }, 1)
    await settle()
    client.take({ ...changed, variation: 0.7 }, 1)
    await settle()
    expect(persistence.saved.at(-1)!.snapshot.runtime.activations.every(value => value === 0)).toBe(true)
    expect(persistence.saved.at(-1)!.snapshot.runtime.previousBassAction).toBeNull()
    expect(persistence.saved.at(-1)!.snapshot.parameters).toEqual(initial.parameters)
    client.dispose()
  })

  it('preserves accepted learning through paused and playing recipe resets', async () => {
    const { client, persistence } = await setup()
    client.teach()
    await settle()
    client.take(recipe, 0)
    await settle()
    const taught = persistence.saved.at(-1)!.snapshot.parameters
    const pausedRecipe = { ...recipe, sessionSeed: 55 }
    client.reset(pausedRecipe)
    await settle()
    client.take(pausedRecipe, 0)
    await settle()
    expect(persistence.saved.at(-1)!.snapshot.parameters).toEqual(taught)
    const playingRecipe = { ...pausedRecipe, presetId: 'fruit-bowl-finals' } as const
    client.update(playingRecipe, 1, true)
    await settle()
    client.take(playingRecipe, 1)
    await settle()
    const saved = persistence.saved.at(-1)!
    expect(saved.snapshot.parameters).toEqual(taught)
    expect(saved.snapshot.runtime.activations.every(value => value === 0)).toBe(true)
    expect(saved.snapshot.runtime.generationIndex).toBe(2)
    expect(client.getDiagnostics().workers).toBe(1)
    client.dispose()
  })

  it('coalesces repeated preparation and ignores responses with another identity', async () => {
    const { client, worker } = await setup()
    client.take(recipe, 0)
    worker.delayPreparation = true
    await settle()
    const pending = worker.held[0]!
    const first = client.ensureReady(recipe, 1)
    const second = client.ensureReady(recipe, 1)
    worker.reply({ ...pending, requestId: 'foreign', type: 'prepared', bass: {} as never, inferenceMs: 0 })
    worker.reply({ ...pending, parentModelRevision: 1, type: 'prepared', bass: {} as never, inferenceMs: 0 })
    expect(client.getDiagnostics()).toMatchObject({ pendingPreparations: 1, readyScores: 1 })
    worker.release()
    await Promise.all([first, second])
    expect(client.getDiagnostics()).toMatchObject({ pendingPreparations: 0, readyScores: 2 })
    expect(worker.requests.filter(message => message.type === 'prepare')).toHaveLength(2)
    client.dispose()
  })

  it('uses ready scores through sequencer pause/resume and tempo/mix/export without advancing twice', async () => {
    const { client, worker, persistence } = await setup()
    const compose = vi.fn(() => { throw new Error('Composition ran inside scheduler') })
    const sequencer = new PlaybackSequencer(compose, recipe, client)
    sequencer.advance()
    await settle()
    const count = worker.requests.length
    sequencer.applyTempoNow(90)
    // No advance calls occur for paused playback, mixer, export, or hidden scene updates.
    await settle()
    expect(worker.requests).toHaveLength(count)
    expect(persistence.saved).toHaveLength(1)
    for (let i = 1; i < 128; i++) sequencer.advance()
    expect(persistence.saved).toHaveLength(1)
    sequencer.advance()
    await settle()
    expect(persistence.saved).toHaveLength(2)
    expect(persistence.saved.at(-1)!.recipe.tempoBpm).toBe(90)
    expect(compose).not.toHaveBeenCalled()
    expect(client.getDiagnostics().readyScores).toBe(2)
    client.dispose()
  })
})
