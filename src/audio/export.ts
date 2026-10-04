import type { PhraseScore, SessionRecipe } from '../music/types'
import type { PresetDefinition } from '../presets/types'
import type { MixSettings } from './rig'
import { eventDurationSeconds, eventTimeSeconds, exportSeconds, EXPORT_FADE_SECONDS } from './timing'
import type { WavData } from './wav'

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

export async function renderPhrase(snapshot: ExportSnapshot): Promise<WavData> {
  const Tone = await import('tone')
  const { createRig } = await import('./rig')
  let context: InstanceType<typeof Tone.OfflineContext> | undefined
  let rig: ReturnType<typeof createRig> | undefined
  let rendered: Awaited<ReturnType<NonNullable<typeof context>['render']>> | undefined
  try {
    context = new Tone.OfflineContext(2, exportSeconds(snapshot.recipe.tempoBpm), 44100)
    rig = createRig(context, snapshot.preset.sound, snapshot.mix)
    if (snapshot.mix.ambienceOn) rig.startAmbience(0)
    for (const event of snapshot.score.events) {
      rig.trigger(event, eventTimeSeconds(event, snapshot.recipe.tempoBpm, snapshot.preset.swing), eventDurationSeconds(event, snapshot.recipe.tempoBpm))
    }
    rendered = await context.render()
    const buffer = rendered.get()!
    const left = new Float32Array(buffer.getChannelData(0))
    const right = new Float32Array(buffer.getChannelData(1))
    const fadeLength = Math.min(left.length, Math.round(EXPORT_FADE_SECONDS * 44100))
    const fadeStart = left.length - fadeLength
    for (let index = 0; index < fadeLength; index++) {
      const gain = fadeLength <= 1 ? 0 : 1 - index / (fadeLength - 1)
      left[fadeStart + index] = index === fadeLength - 1 ? 0 : left[fadeStart + index] * gain
      right[fadeStart + index] = index === fadeLength - 1 ? 0 : right[fadeStart + index] * gain
    }
    return { sampleRate: 44100, channels: [left, right] }
  } finally {
    rendered?.dispose()
    rig?.dispose()
    context?.dispose()
  }
}
