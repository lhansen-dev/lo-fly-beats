import { describe, expect, it } from 'vitest'
import { isStorageAvailable, loadSettings, SETTINGS_KEY } from './persistence'

function memoryStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(SETTINGS_KEY, initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    map,
  }
}

const validSettings = {
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
