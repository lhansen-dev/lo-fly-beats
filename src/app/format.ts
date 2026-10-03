import { getPreset } from '../presets/presets'
import type { SessionRecipe } from '../music/types'

export function formatPosition(position: { phraseIndex: number; bar: number; beat: number }): string {
  return `Phrase ${position.phraseIndex + 1} · Bar ${position.bar + 1} · Beat ${position.beat + 1}`
}

export function describePendingChanges(pending: Partial<Pick<SessionRecipe, 'tempoBpm' | 'variation' | 'sessionSeed' | 'presetId'>>): string {
  const changes: string[] = []
  if (pending.presetId) changes.push(`${getPreset(pending.presetId).name} at the next phrase`)
  else if (pending.tempoBpm !== undefined) changes.push(`${pending.tempoBpm} BPM at the next bar`)
  if (pending.variation !== undefined) changes.push(`Variation ${Math.round(pending.variation * 100)} at the next phrase`)
  if (pending.sessionSeed !== undefined) changes.push('New beat at the next phrase')
  return changes.join(' · ')
}
