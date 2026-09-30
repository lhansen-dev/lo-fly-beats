import { describe, expect, it } from 'vitest'
import { PRESETS } from '../presets/presets'
import { applyRingRule, bassRootMidi, chooseVoicing, chordPitchClasses, ringIndexFor, voicingCandidates } from './harmony'
import { fnv1a32 } from './rng'

const keyScales: Record<string, Set<number>> = {
  'rainy-windowsill': new Set([0, 2, 4, 5, 7, 9, 10]),
  'overripe-2am': new Set([0, 2, 3, 5, 7, 8, 10]),
  'fruit-bowl-finals': new Set([0, 2, 4, 6, 7, 9, 11]),
}

describe('preset harmony', () => {
  it('defines six diatonic chords in every preset', () => {
    for (const preset of Object.values(PRESETS)) {
      const scale = keyScales[preset.id]!
      expect(preset.chordRing).toHaveLength(6)
      for (const chord of preset.chordRing) {
        expect(scale.has(chord.root)).toBe(true)
        expect(scale.has((chord.root + 7) % 12)).toBe(true)
        expect(chordPitchClasses(chord).every(pitch => scale.has(pitch))).toBe(true)
      }
    }
  })

  it('reproduces the authored voice-leading vectors', () => {
    const rainy = PRESETS['rainy-windowsill']
    const rainyFirst = chooseVoicing(rainy.chordRing[0]!, rainy.keysRange, null)
    expect(rainyFirst).toEqual([57, 60, 64, 65])
    expect(chooseVoicing(rainy.chordRing[2]!, rainy.keysRange, rainyFirst)).toEqual([57, 58, 62, 65])
    expect(chooseVoicing(rainy.chordRing[1]!, rainy.keysRange, [57, 58, 62, 65])).toEqual([57, 60, 62, 65])
    const overripe = PRESETS['overripe-2am']
    expect(chooseVoicing(overripe.chordRing[0]!, overripe.keysRange, null)).toEqual([55, 58, 62, 63])
    const fruit = PRESETS['fruit-bowl-finals']
    expect(chooseVoicing(fruit.chordRing[0]!, fruit.keysRange, null)).toEqual([60, 64, 67, 71])
  })

  it('keeps every voicing candidate within range with four ascending notes', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const chord of preset.chordRing) {
        for (const candidate of voicingCandidates(chord, preset.keysRange)) {
          expect(candidate).toHaveLength(4)
          expect(candidate[0]).toBeGreaterThanOrEqual(preset.keysRange.low)
          expect(candidate[3]).toBeLessThanOrEqual(preset.keysRange.high)
          expect(candidate[0]! < candidate[1]! && candidate[1]! < candidate[2]! && candidate[2]! < candidate[3]!).toBe(true)
        }
      }
    }
  })

  it('maps roots to the bass octave', () => {
    expect(bassRootMidi(0)).toBe(36)
    expect(bassRootMidi(2)).toBe(38)
    expect(bassRootMidi(11)).toBe(47)
  })

  it('steps a ring position that repeats the previous chosen position', () => {
    expect(applyRingRule([3, 3, 3, 5])).toEqual([
      { index: 3, stepped: false }, { index: 4, stepped: true }, { index: 3, stepped: false }, { index: 5, stepped: false },
    ])
    expect(applyRingRule([5, 5])).toEqual([{ index: 5, stepped: false }, { index: 0, stepped: true }])
  })

  it('hashes a missing neuron type through its ID fallback', () => {
    expect(ringIndexFor({ id: '5', type: null })).toBe(fnv1a32('id:5') % 6)
  })
})
