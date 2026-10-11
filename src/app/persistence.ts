import { z } from 'zod'
import type { RestoredSettings } from './state'

export const SETTINGS_KEY = 'lofly:settings:v1'

export interface SettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type StorageAccessor = () => SettingsStorage | null

export interface SettingsSaver {
  save(settings: RestoredSettings): void
  flush(): void
  cancel(): void
}

export function createSettingsSaver(getStorage: StorageAccessor, delayMs = 500, onUnavailable?: () => void): SettingsSaver {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: RestoredSettings | null = null
  let unavailableReported = false

  function reportUnavailable() {
    if (unavailableReported) return
    unavailableReported = true
    onUnavailable?.()
  }

  function writePending() {
    if (pending === null) return
    const settings = pending
    pending = null
    try {
      const storage = getStorage()
      if (storage === null) {
        reportUnavailable()
        return
      }
      storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      reportUnavailable()
    }
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    save(settings) {
      pending = settings
      clearTimer()
      timer = setTimeout(() => {
        timer = null
        writePending()
      }, delayMs)
    },
    flush() {
      clearTimer()
      writePending()
    },
    cancel() {
      clearTimer()
      pending = null
    },
  }
}

const layerSchema = z.strictObject({
  level: z.number().min(0).max(1),
  muted: z.boolean(),
})

export const settingsSchema = z.strictObject({
  mappingVersion: z.number().int(),
  presetVersion: z.number().int(),
  presetId: z.enum(['rainy-windowsill', 'overripe-2am', 'fruit-bowl-finals']),
  sessionSeed: z.number().int().min(0).max(4294967295),
  tempoBpm: z.number().int().min(60).max(100),
  variation: z.number().min(0).max(1),
  mix: z.strictObject({
    masterVolume: z.number().min(0).max(1),
    layers: z.strictObject({
      drums: layerSchema,
      bass: layerSchema,
      keys: layerSchema,
      // Settings saved before the fly learned to play lead melodies have no lead layer.
      lead: layerSchema.default({ level: 0.55, muted: false }),
    }),
    // Settings saved before the rain and vinyl ambience was removed still carry this flag.
    ambienceOn: z.boolean().optional(),
  }).transform(({ ambienceOn: _removed, ...mix }) => mix),
  animationEnabled: z.boolean().nullable(),
})

export function loadSettings(getStorage: StorageAccessor): RestoredSettings | null {
  try {
    const storage = getStorage()
    if (storage === null) return null
    const value = storage.getItem(SETTINGS_KEY)
    if (value === null) return null
    const parsed = JSON.parse(value) as unknown
    const result = settingsSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function isStorageAvailable(getStorage: StorageAccessor): boolean {
  try {
    const storage = getStorage()
    if (storage === null) return false
    storage.getItem(SETTINGS_KEY)
    return true
  } catch {
    return false
  }
}
