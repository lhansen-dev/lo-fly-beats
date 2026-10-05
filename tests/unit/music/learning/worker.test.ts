import { describe, expect, it } from 'vitest'
import { buildPhrasePlan } from '../../../../src/music/compose'
import { createLearningSnapshot, phraseInput, preparePhrase } from '../../../../src/music/learning/session'
import { createLearningWorkerRuntime } from '../../../../src/music/learning/workerRuntime'
import type { LearningWorkerResponse, WorkerIdentity } from '../../../../src/music/learning/workerProtocol'
import { fixtureGraph } from '../../helpers/fixtureGraph'
import { learningModel } from './fixture'

const model = learningModel()
const graph = fixtureGraph()
const snapshot = createLearningSnapshot(graph.checksum, model)
const recipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 0, tempoBpm: 80 } as const
const plan = buildPhrasePlan(graph, recipe, 0)
const tag: WorkerIdentity = { requestId: 'request', recipeGeneration: 17, parentModelRevision: 0 }
async function setup() {
  const responses: LearningWorkerResponse[] = []
  const tasks: Array<() => void> = []
  const runtime = createLearningWorkerRuntime(async () => model, response => responses.push(response), task => tasks.push(task))
  await runtime.receive({ ...tag, type: 'initialize', baseUrl: '/', accompanimentChecksum: graph.checksum })
  return { runtime, responses, tasks }
}

describe('dedicated learning worker protocol', () => {
  it('returns identity on every response and reproduces pure inference after restore', async () => {
    const { runtime, responses } = await setup()
    expect(responses[0]).toMatchObject({ ...tag, type: 'initialized', snapshot })
    await runtime.receive({ ...tag, type: 'restore', snapshot })
    await runtime.receive({ ...tag, type: 'prepare', snapshot, input: phraseInput(plan) })
    const prepared = responses.at(-1)!
    expect(prepared).toMatchObject({ ...tag, type: 'prepared' })
    if (prepared.type === 'prepared') {
      const pure = preparePhrase(plan, snapshot, model)
      expect(prepared.bass.endingRuntime).toEqual(pure.endingRuntime)
      expect(prepared.bass.provenance).toEqual(pure.score.learning)
      expect(prepared.inferenceMs).toBeGreaterThanOrEqual(0)
    }
    for (const response of responses) expect(response).toMatchObject(tag)
  })

  it('runs preparation ahead of scheduled training chunks and cancels without replacing parameters', async () => {
    const { runtime, responses, tasks } = await setup()
    await runtime.receive({ ...tag, requestId: 'teach', type: 'teach', parameters: snapshot.parameters,
      training: [phraseInput(plan)], validation: [phraseInput(plan)] })
    expect(tasks).toHaveLength(1)
    await runtime.receive({ ...tag, type: 'prepare', snapshot, input: phraseInput(plan) })
    expect(responses.at(-1)!.type).toBe('prepared')
    tasks.shift()!()
    expect(tasks).toHaveLength(1)
    await runtime.receive({ ...tag, requestId: 'teach', type: 'cancel' })
    const cancelled = responses.at(-1)!
    expect(cancelled).toMatchObject({ requestId: 'teach', type: 'taught', candidate: { status: 'rejected', updates: 128, decoderWeights: null } })
    tasks.shift()!()
    expect(tasks).toHaveLength(0)
    expect(responses.filter(response => response.type === 'taught')).toHaveLength(1)
    expect(snapshot.parameters.trainingUpdateCount).toBe(0)
  })

  it('rejects duplicate teaching, invalid snapshots, and stale parents', async () => {
    const { runtime, responses } = await setup()
    const teach = { ...tag, type: 'teach' as const, parameters: snapshot.parameters, training: [phraseInput(plan)], validation: [phraseInput(plan)] }
    await runtime.receive(teach)
    await runtime.receive({ ...teach, requestId: 'duplicate' })
    expect(responses.at(-1)).toMatchObject({ requestId: 'duplicate', type: 'error' })
    await runtime.receive({ ...tag, type: 'restore', snapshot: { ...snapshot, runtime: { ...snapshot.runtime, activations: [NaN] } } })
    expect(responses.at(-1)).toMatchObject({ ...tag, type: 'error' })
    await runtime.receive({ ...tag, parentModelRevision: 9, type: 'prepare', snapshot, input: phraseInput(plan) })
    expect(responses.at(-1)).toMatchObject({ ...tag, parentModelRevision: 9, type: 'error' })
  })

  it('finishes one finite decoder candidate with a bounded update budget and unchanged fixed weights', async () => {
    const { runtime, responses, tasks } = await setup()
    const fixed = structuredClone(model)
    await runtime.receive({ ...tag, type: 'teach', parameters: snapshot.parameters,
      training: [phraseInput(plan)], validation: [phraseInput(plan)] })
    let chunks = 0
    while (tasks.length) { tasks.shift()!(); chunks++ }
    expect(chunks).toBe(Math.ceil(20_000 / 128))
    expect(responses.at(-1)).toMatchObject({ ...tag, type: 'taught', candidate: { status: 'accepted', updates: 20_000, parentModelRevision: 0 } })
    expect(model).toEqual(fixed)
    expect(snapshot.parameters.trainingUpdateCount).toBe(0)
  }, 30_000)
})
