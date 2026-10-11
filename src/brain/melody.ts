import { chordPitchClasses } from '../music/harmony'
import { getPreset } from '../presets/presets'
import type { PresetId } from '../presets/types'
import { CHORD_STEPS, HEADS, LEAD_DEGREES } from './vocabulary'

/**
 * The lead moves like a singer thinks: by relative steps, skips, and leaps through the key's
 * scale, or by settling on the nearest chord tone. Absolute pitch is carried as state.
 */
export const LEAD_START_DEGREE = 4

export const LEAD_SCALES: Readonly<Record<PresetId, { tonic: number; mode: readonly number[]; name: string }>> = Object.freeze({
  'rainy-windowsill': { tonic: 2, mode: [0, 2, 3, 5, 7, 8, 10], name: 'D natural minor' },
  'overripe-2am': { tonic: 0, mode: [0, 2, 3, 5, 7, 8, 10], name: 'C natural minor' },
  'fruit-bowl-finals': { tonic: 9, mode: [0, 2, 3, 5, 7, 9, 10], name: 'A Dorian' },
})

export function leadMidi(presetId: PresetId, degree: number): number {
  if (!Number.isInteger(degree) || degree < 0 || degree >= LEAD_DEGREES) throw new RangeError('Invalid lead degree')
  const scale = LEAD_SCALES[presetId]
  let base = 60 + scale.tonic
  if (base > 66) base -= 12
  return base + 12 * Math.floor(degree / 7) + scale.mode[degree % 7]!
}

const chordToneCache = new Map<string, number[]>()

/** Scale degrees in the lead's range whose pitch class belongs to the chord. */
export function chordToneDegrees(presetId: PresetId, ring: number): number[] {
  const key = `${presetId}|${ring}`
  let degrees = chordToneCache.get(key)
  if (!degrees) {
    const chord = getPreset(presetId).chordRing[ring]
    if (!chord) throw new RangeError('Invalid chord ring index')
    const tones = new Set(chordPitchClasses(chord).concat([chord.root]))
    degrees = Array.from({ length: LEAD_DEGREES }, (_, degree) => degree).filter(degree => tones.has(leadMidi(presetId, degree) % 12))
    chordToneCache.set(key, degrees)
  }
  return degrees
}

export function isChordTone(presetId: PresetId, ring: number, degree: number): boolean {
  return chordToneDegrees(presetId, ring).includes(degree)
}

const MOVES: Readonly<Record<string, number>> = { same: 0, up1: 1, down1: -1, up2: 2, down2: -2, up3: 3, down3: -3, up4: 4, down4: -4 }

/** The degree an onset action lands on. Moves past the range fold back by an octave (7 degrees). */
export function resolveLeadDegree(previous: number, action: number, presetId: PresetId, ring: number): number {
  const name = HEADS.lead[action]!
  if (name === 'hold' || name === 'rest') return previous
  let degree: number
  if (name === 'chord') {
    const tones = chordToneDegrees(presetId, ring)
    degree = tones.reduce((best, tone) => Math.abs(tone - previous) < Math.abs(best - previous) ? tone : best, tones[0]!)
  } else {
    degree = previous + MOVES[name]!
  }
  while (degree >= LEAD_DEGREES) degree -= 7
  while (degree < 0) degree += 7
  return degree
}

export function isLeadOnset(action: number): boolean {
  return action >= 2
}

/** Onset degree at each step (null without an onset) and the degree the phrase ends on. */
export function leadDegrees(lead: readonly number[], chords: readonly number[], presetId: PresetId, start: number): { degrees: (number | null)[]; end: number } {
  let current = start
  const degrees = lead.map((action, step) => {
    if (!isLeadOnset(action)) return null
    current = resolveLeadDegree(current, action, presetId, chords[Math.floor(step / CHORD_STEPS)]!)
    return current
  })
  return { degrees, end: current }
}

/** The action that best reproduces a target degree from the previous one. */
export function encodeLeadMove(previous: number, target: number, presetId: PresetId, ring: number): { action: number; degree: number } {
  const delta = target - previous
  const names: Record<number, string> = { 0: 'same', 1: 'up1', [-1]: 'down1', 2: 'up2', [-2]: 'down2', 3: 'up3', [-3]: 'down3', 4: 'up4', [-4]: 'down4' }
  const index = (name: string) => (HEADS.lead as readonly string[]).indexOf(name)
  let action: number
  if (names[delta] !== undefined) action = index(names[delta]!)
  else if (resolveLeadDegree(previous, index('chord'), presetId, ring) === target) action = index('chord')
  else action = index(names[Math.max(-4, Math.min(4, delta))]!)
  return { action, degree: resolveLeadDegree(previous, action, presetId, ring) }
}
