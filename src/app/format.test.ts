import { describe, expect, it } from 'vitest'
import { describePendingChanges, formatPosition } from './format'

describe('formatPosition', () => {
  it('formats the first position', () => {
    expect(formatPosition({ phraseIndex: 0, bar: 0, beat: 0 })).toBe('Phrase 1 · Bar 1 · Beat 1')
  })

  it('formats later positions', () => {
    expect(formatPosition({ phraseIndex: 3, bar: 2, beat: 1 })).toBe('Phrase 4 · Bar 3 · Beat 2')
  })
})

describe('describePendingChanges', () => {
  it('returns an empty string when there are no changes', () => {
    expect(describePendingChanges({})).toBe('')
  })

  it('describes tempo changes', () => {
    expect(describePendingChanges({ tempoBpm: 80 })).toBe('80 BPM at the next bar')
  })

  it('prioritizes preset over tempo', () => {
    expect(describePendingChanges({ presetId: 'fruit-bowl-finals', tempoBpm: 86 })).toBe('Fruit Bowl Finals at the next phrase')
  })

  it('describes variation changes', () => {
    expect(describePendingChanges({ variation: 0.4 })).toBe('Variation 40 at the next phrase')
  })

  it('describes a new beat', () => {
    expect(describePendingChanges({ sessionSeed: 7 })).toBe('New beat at the next phrase')
  })

  it('combines preset, variation, and new beat changes in order', () => {
    expect(describePendingChanges({ presetId: 'overripe-2am', tempoBpm: 64, variation: 1, sessionSeed: 7 })).toBe('Overripe at 2 AM at the next phrase · Variation 100 at the next phrase · New beat at the next phrase')
  })
})
