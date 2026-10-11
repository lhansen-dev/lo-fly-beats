import type { PhraseScore, SessionRecipe } from '../music/types'
import type { PresetDefinition } from '../presets/types'
import type { MixSettings } from './rig'
import { eventDurationSeconds, eventTimeSeconds, exportSeconds, EXPORT_FADE_SECONDS, EXPORT_TAIL_SECONDS, phraseSeconds } from './timing'
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

/** The limiter's attack can let a transient overshoot; exports are scaled so they never clip. */
export const EXPORT_PEAK_CEILING = 0.94

export function guardPeaks(channels: Float32Array[]): void {
  let peak = 0
  for (const channel of channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample))
  if (peak <= EXPORT_PEAK_CEILING) return
  const gain = EXPORT_PEAK_CEILING / peak
  for (const channel of channels) for (let index = 0; index < channel.length; index++) channel[index] = channel[index]! * gain
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
    guardPeaks([left, right])
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

/**
 * Render consecutive phrases into one continuous tape, the same way playback places them back to
 * back. All scores must share the recipe's tempo; a short tail lets the last notes ring out.
 */
export async function renderTrack(scores: readonly PhraseScore[], recipe: SessionRecipe, preset: PresetDefinition, mix: MixSettings): Promise<WavData> {
  if (scores.length === 0) throw new Error('A track needs at least one phrase')
  const Tone = await import('tone')
  const { createRig } = await import('./rig')
  const phrase = phraseSeconds(recipe.tempoBpm)
  const total = phrase * scores.length + EXPORT_TAIL_SECONDS
  const context = new Tone.OfflineContext(2, total, 44100)
  const rig = createRig(context, preset.sound, mix)
  try {
    if (mix.ambienceOn) rig.startAmbience(0)
    scores.forEach((score, index) => {
      for (const event of score.events) {
        rig.trigger(event, index * phrase + eventTimeSeconds(event, recipe.tempoBpm, preset.swing), eventDurationSeconds(event, recipe.tempoBpm))
      }
    })
    const rendered = await context.render()
    try {
      const buffer = rendered.get()!
      const channels = [new Float32Array(buffer.getChannelData(0)), new Float32Array(buffer.getChannelData(1))]
      guardPeaks(channels)
      const fadeLength = Math.round(EXPORT_FADE_SECONDS * 2 * 44100)
      for (const channel of channels) {
        for (let index = 0; index < fadeLength; index++) channel[channel.length - fadeLength + index]! *= 1 - index / (fadeLength - 1)
      }
      return { sampleRate: 44100, channels }
    } finally { rendered.dispose() }
  } finally {
    rig.dispose()
    context.dispose()
  }
}
