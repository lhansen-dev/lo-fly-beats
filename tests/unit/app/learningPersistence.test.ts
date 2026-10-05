import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createLearningSnapshot, commitPhrase, preparePhrase } from '../../../src/music/learning/session'
import { validateLearningSnapshot } from '../../../src/music/learning/snapshot'
import { buildPhrasePlan } from '../../../src/music/compose'
import { learningModel } from '../music/learning/fixture'
import { fixtureGraph } from '../helpers/fixtureGraph'
import { createLearningPersistence, validateCheckpoint, type LearningCheckpoint } from '../../../src/app/learningPersistence'

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> }

const graph = fixtureGraph()
const model = learningModel()
const snapshot = createLearningSnapshot(graph.checksum, model)
const recipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, tempoBpm: 80, variation: 0.5 } as const
const checkpoint: LearningCheckpoint = { checkpointVersion: 1, presetVersion: 1, recipe, phraseIndex: 0, snapshot }

describe('strict checkpoint compatibility', () => {
  it('accepts a boundary and preserves the next score and following runtime', () => {
    const first = preparePhrase(buildPhrasePlan(graph, recipe, 0), snapshot, model)
    const next = commitPhrase(first, snapshot, first.requestId)!.nextSnapshot
    const saved = { ...checkpoint, snapshot: next, phraseIndex: 1 }
    const restored = validateCheckpoint(structuredClone(saved), snapshot)!
    expect(restored).toEqual(saved)
    expect(preparePhrase(buildPhrasePlan(graph, recipe, 1), restored.snapshot, model))
      .toEqual(preparePhrase(buildPhrasePlan(graph, recipe, 1), next, model))
  })

  it.each([
    (s: Mutable<typeof snapshot>) => { s.parameters.graphChecksum = 'other' },
    (s: Mutable<typeof snapshot>) => { s.compatibility.accompanimentGraphChecksum = 'other' },
    (s: Mutable<typeof snapshot>) => { s.compatibility.snapshotVersion++ },
    (s: Mutable<typeof snapshot>) => { s.compatibility.mappingVersion++ },
    (s: Mutable<typeof snapshot>) => { s.parameters.inputVersion++ },
    (s: Mutable<typeof snapshot>) => { s.parameters.vocabularyVersion++ },
    (s: Mutable<typeof snapshot>) => { s.parameters.modelSeed++ },
    (s: Mutable<typeof snapshot>) => { s.parameters.configuration.retention = 0.5 },
    (s: Mutable<typeof snapshot>) => { s.parameters.configuration.recentActionLimit = 100 },
    (s: Mutable<typeof snapshot>) => { s.parameters.decoderWeights = [0] },
    (s: Mutable<typeof snapshot>) => { s.parameters.decoderWeights = Array(882).fill(NaN) },
    (s: Mutable<typeof snapshot>) => { s.parameters.decoderWeights = Array(882).fill(1e10) },
    (s: Mutable<typeof snapshot>) => { s.runtime.activations = [0] },
    (s: Mutable<typeof snapshot>) => { s.runtime.activations = Array(97).fill(1.01) },
    (s: Mutable<typeof snapshot>) => { s.runtime.generationIndex = -1 },
    (s: Mutable<typeof snapshot>) => { s.requestRevision = Number.MAX_SAFE_INTEGER },
    (s: Mutable<typeof snapshot>) => { s.runtime.recentActions = [{ contextBeatIndex: 0, cellId: 'fifth', forcedRest: true }] },
    (s: Mutable<typeof snapshot>) => { s.recentMotifs = Array(9).fill({ generationIndex: 0, firstBeat: 0, cells: [], eligibleMask: [] }) },
  ])('rejects malformed or incompatible state %#', mutate => {
    const copy = structuredClone(snapshot) as Mutable<typeof snapshot>
    mutate(copy)
    expect(validateLearningSnapshot(copy, snapshot)).toBeNull()
  })

  it('rejects unknown fields and incompatible recipe/preset identity', () => {
    expect(validateCheckpoint({ ...checkpoint, unexpected: true }, snapshot)).toBeNull()
    expect(validateCheckpoint({ ...checkpoint, presetVersion: 99 }, snapshot)).toBeNull()
    expect(validateCheckpoint({ ...checkpoint, phraseIndex: 0.5 }, snapshot)).toBeNull()
    expect(validateCheckpoint({ ...checkpoint, recipe: { ...recipe, tempoBpm: Infinity } }, snapshot)).toBeNull()
    expect(validateCheckpoint({ ...checkpoint, snapshot: { ...snapshot, endingRuntime: snapshot.runtime } }, snapshot)).toBeNull()
  })
})

describe('transactional IndexedDB checkpoints', () => {
  it('rotates both snapshots in one transaction and reopens with them intact', async () => {
    const factory = new IDBFactory()
    const store = createLearningPersistence(() => factory)
    await store.save(checkpoint)
    const second = { ...checkpoint, phraseIndex: 1 }
    await store.save(second)
    expect(await store.read()).toEqual({ current: second, previous: checkpoint })
    store.close()
    const reopened = createLearningPersistence(() => factory)
    expect(await reopened.read()).toEqual({ current: second, previous: checkpoint })
    reopened.close()
  })

  it('leaves both committed records intact when a transaction cannot write a value', async () => {
    const factory = new IDBFactory()
    const store = createLearningPersistence(() => factory)
    await store.save(checkpoint)
    await store.save({ ...checkpoint, phraseIndex: 1 })
    const saved = await store.read()
    // Structured-clone failure aborts the transaction, including the previous rotation.
    const uncloneable = { ...checkpoint, uncloneable: () => {} }
    await expect(store.save(uncloneable)).rejects.toThrow()
    expect(await store.read()).toEqual(saved)
    store.close()
  })

  it('reports unavailable and access-denied storage asynchronously', async () => {
    for (const accessor of [() => null, () => { throw new Error('denied') }]) {
      const store = createLearningPersistence(accessor)
      await expect(store.read()).rejects.toThrow()
      await expect(store.save(checkpoint)).rejects.toThrow()
      store.close()
    }
  })
})
