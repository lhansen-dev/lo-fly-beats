import type { PhraseScore, SessionRecipe } from '../music/types'
import type { PresetDefinition } from '../presets/types'
import type { MixSettings } from './rig'

export interface ExportSnapshot {
  score: PhraseScore
  recipe: SessionRecipe
  preset: PresetDefinition
  mix: MixSettings
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export function createExportSnapshot(
  score: PhraseScore,
  recipe: SessionRecipe,
  preset: PresetDefinition,
  mix: MixSettings,
): ExportSnapshot {
  return deepFreeze(structuredClone({ score, recipe, preset, mix }))
}
