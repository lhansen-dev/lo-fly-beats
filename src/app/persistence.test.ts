import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSettingsSaver, isStorageAvailable, loadSettings, SETTINGS_KEY } from './persistence'
import type { RestoredSettings } from './state'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(SETTINGS_KEY, initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    map,
  }
}

const validSettings: RestoredSettings = {
  mappingVersion: 2,
  presetVersion: 1,
  presetId: 'rainy-windowsill',
  sessionSeed: 4294967295,
  tempoBpm: 72,
  variation: 0.5,
  mix: {
    masterVolume: 0.8,
    layers: {
      drums: { level: 0.7, muted: false },
      bass: { level: 0.6, muted: false },
      keys: { level: 0.5, muted: true },
    },
    ambienceOn: true,
  },
  animationEnabled: null,
}

describe('settings persistence', () => {
  it('returns null for empty storage', () => {
    const storage = memoryStorage()
    expect(loadSettings(() => storage)).toBeNull()
  })

  it('loads valid stored settings', () => {
    const storage = memoryStorage(JSON.stringify(validSettings))
    expect(loadSettings(() => storage)).toEqual(validSettings)
  })

  it('returns null for invalid JSON or an invalid shape', () => {
    expect(loadSettings(() => memoryStorage('{not json'))).toBeNull()
    expect(loadSettings(() => memoryStorage('{"presetId":"nope"}'))).toBeNull()
  })

  it('handles storage access errors', () => {
    const storage = { getItem: () => { throw new Error('blocked') }, setItem: () => {} }
    expect(loadSettings(() => storage)).toBeNull()
    expect(isStorageAvailable(() => storage)).toBe(false)
    expect(loadSettings(() => { throw new Error('blocked') })).toBeNull()
  })

  it('handles unavailable storage and reports availability', () => {
    expect(loadSettings(() => null)).toBeNull()
    expect(isStorageAvailable(() => null)).toBe(false)
    expect(isStorageAvailable(() => memoryStorage())).toBe(true)
  })
})

describe('settings saver', () => {
  afterEach(() => vi.useRealTimers())

  it('debounces writes and stores the latest settings', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    const saver = createSettingsSaver(() => storage)
    saver.save(validSettings)
    saver.save({ ...validSettings, tempoBpm: 80 })
    expect(storage.map.size).toBe(0)
    vi.advanceTimersByTime(500)
    expect(storage.map.size).toBe(1)
    expect(loadSettings(() => storage)).toEqual({ ...validSettings, tempoBpm: 80 })
  })

  it('uses a custom delay', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    createSettingsSaver(() => storage, 10).save(validSettings)
    vi.advanceTimersByTime(9)
    expect(storage.map.size).toBe(0)
    vi.advanceTimersByTime(1)
    expect(storage.map.size).toBe(1)
  })

  it('flushes immediately and cancels pending writes', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    const saver = createSettingsSaver(() => storage)
    saver.save(validSettings)
    saver.flush()
    expect(loadSettings(() => storage)).toEqual(validSettings)
    storage.map.clear()
    saver.save(validSettings)
    saver.cancel()
    vi.advanceTimersByTime(500)
    expect(storage.map.size).toBe(0)
  })

  it('reports throwing storage once without throwing from the timer', () => {
    vi.useFakeTimers()
    const onUnavailable = vi.fn()
    const storage = { getItem: () => null, setItem: () => { throw new Error('blocked') } }
    const saver = createSettingsSaver(() => storage, 10, onUnavailable)
    expect(() => saver.save(validSettings)).not.toThrow()
    expect(() => vi.advanceTimersByTime(10)).not.toThrow()
    saver.save(validSettings)
    vi.advanceTimersByTime(10)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })
})
