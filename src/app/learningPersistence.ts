import { z } from 'zod'
import { validateLearningSnapshot } from '../music/learning/snapshot'
import type { LearningSnapshot } from '../music/learning/types'
import type { SessionRecipe } from '../music/types'
import { getPreset } from '../presets/presets'

export const LEARNING_DATABASE = 'lofly-learning-v1'
export const LEARNING_STORE = 'checkpoints'
export interface LearningCheckpoint {
  checkpointVersion: 1
  presetVersion: number
  recipe: SessionRecipe
  phraseIndex: number
  snapshot: LearningSnapshot
}
export interface LearningCheckpointStore {
  read(): Promise<{ current: unknown; previous: unknown }>
  save(checkpoint: LearningCheckpoint): Promise<void>
  close(): void
}
const checkpointSchema = z.strictObject({
  checkpointVersion: z.literal(1), presetVersion: z.number().int(), phraseIndex: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1024),
  recipe: z.strictObject({
    recipeVersion: z.literal(1), presetId: z.enum(['rainy-windowsill', 'overripe-2am', 'fruit-bowl-finals']),
    sessionSeed: z.number().int().min(0).max(4294967295), tempoBpm: z.number().int().min(60).max(100),
    variation: z.number().min(0).max(1),
  }), snapshot: z.unknown(),
})
export function validateCheckpoint(value: unknown, template: LearningSnapshot): LearningCheckpoint | null {
  const parsed = checkpointSchema.safeParse(value)
  if (!parsed.success || parsed.data.presetVersion !== getPreset(parsed.data.recipe.presetId).version) return null
  const snapshot = validateLearningSnapshot(parsed.data.snapshot, template)
  return snapshot ? { ...parsed.data, snapshot } : null
}

/** A single read/write transaction rotates current and previous; abort leaves both intact. */
export function createLearningPersistence(getFactory: () => IDBFactory | null = () => globalThis.indexedDB): LearningCheckpointStore {
  let connection: Promise<IDBDatabase> | null = null
  let closed = false
  const open = () => {
    if (closed) return Promise.reject(new Error('Checkpoint store is closed'))
    if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
      const factory = getFactory()
      if (!factory) { reject(new Error('IndexedDB is unavailable')); return }
      const request = factory.open(LEARNING_DATABASE, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(LEARNING_STORE)
      request.onerror = () => reject(request.error ?? new Error('Could not open checkpoints'))
      request.onblocked = () => reject(new Error('Checkpoint database upgrade is blocked'))
      request.onsuccess = () => {
        const db = request.result
        if (closed) { db.close(); reject(new Error('Checkpoint store is closed')); return }
        db.onversionchange = () => db.close()
        resolve(db)
      }
    })
    return connection
  }
  return {
    async read() {
      const db = await open()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(LEARNING_STORE, 'readonly')
        const store = transaction.objectStore(LEARNING_STORE)
        const current = store.get('current')
        const previous = store.get('previous')
        transaction.oncomplete = () => resolve({ current: current.result, previous: previous.result })
        transaction.onabort = () => reject(transaction.error ?? new Error('Checkpoint read aborted'))
        transaction.onerror = () => reject(transaction.error ?? new Error('Checkpoint read failed'))
      })
    },
    async save(checkpoint) {
      const db = await open()
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(LEARNING_STORE, 'readwrite')
        const store = transaction.objectStore(LEARNING_STORE)
        const current = store.get('current')
        current.onsuccess = () => {
          try {
            // Do not replace the recovery copy with a corrupt/incompatible current record.
            if (validateCheckpoint(current.result, checkpoint.snapshot)) store.put(current.result, 'previous')
            store.put(checkpoint, 'current')
          } catch { transaction.abort() }
        }
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error ?? new Error('Checkpoint save aborted'))
        transaction.onerror = () => reject(transaction.error ?? new Error('Checkpoint save failed'))
      })
    },
    close() { closed = true; void connection?.then(db => db.close(), () => undefined) },
  }
}
