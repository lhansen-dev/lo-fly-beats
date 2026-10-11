import type { BrainStore, SavedBrain } from './mind'

const DATABASE = 'lofly-brain-v1'
const STORE = 'fly'
const KEY = 'current'

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result)
    operation.onerror = () => reject(operation.error ?? new Error('IndexedDB request failed'))
  })
}

/** One saved fly per browser profile, kept apart from listening settings. */
export function createBrainStore(factory: IDBFactory | undefined = globalThis.indexedDB): BrainStore | null {
  if (!factory) return null
  let database: Promise<IDBDatabase> | null = null
  const open = () => database ??= new Promise((resolve, reject) => {
    const opening = factory.open(DATABASE, 1)
    opening.onupgradeneeded = () => { if (!opening.result.objectStoreNames.contains(STORE)) opening.result.createObjectStore(STORE) }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error ?? new Error('Could not open the fly brain store'))
  })
  const transaction = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE)
  return {
    async load() {
      const value = await request((await transaction('readonly')).get(KEY)) as (Omit<SavedBrain, 'readout'> & { readout: ArrayBuffer }) | undefined
      if (!value || !(value.readout instanceof ArrayBuffer) || value.readout.byteLength % 4 !== 0) return null
      return { ...value, readout: new Float32Array(value.readout) }
    },
    async save(brain) {
      const store = await transaction('readwrite')
      await request(store.put({ ...brain, readout: brain.readout.slice().buffer }, KEY))
    },
    async clear() {
      await request((await transaction('readwrite')).delete(KEY))
    },
  }
}
