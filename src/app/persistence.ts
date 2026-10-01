import { z } from 'zod'
import type { RestoredSettings } from './state'

export const SETTINGS_KEY = 'lofly:settings:v1'

export interface SettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type StorageAccessor = () => SettingsStorage | null

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
    }),
    ambienceOn: z.boolean(),
  }),
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
