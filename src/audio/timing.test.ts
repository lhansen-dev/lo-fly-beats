import { describe, expect, it } from 'vitest'
import { eventDurationSeconds, eventOffsetSeconds, eventTimeSeconds, exportSeconds, midiToHz, phraseSeconds, secondsPerStep, swingOffsetSteps } from './timing'
import type { NoteEvent } from '../music/types'

const event: NoteEvent = { layer: 'keys', step: 3, microOffset: 0.02, durationSteps: 2, midi: 69, drum: null, velocity: 0.5, traceBeat: null }

describe('timing adapter', () => {
  it('matches all documented timing values', () => {
    expect(secondsPerStep(72)).toBeCloseTo(0.2083, 4)
    expect(phraseSeconds(72)).toBeCloseTo(26.667, 3)
    expect(exportSeconds(72)).toBeCloseTo(28.667, 3)
    expect(secondsPerStep(60)).toBe(0.25)
    expect(phraseSeconds(60)).toBe(32)
    expect(exportSeconds(60)).toBe(34)
    expect(secondsPerStep(100)).toBe(0.15)
    expect(phraseSeconds(100)).toBeCloseTo(19.2)
    expect(exportSeconds(100)).toBeCloseTo(21.2)
    expect(swingOffsetSteps(1, 0.56)).toBeCloseTo(0.12)
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(57)).toBe(220)
  })

  it('combines swing and microtiming consistently', () => {
    expect(eventOffsetSeconds(event, 60, 0.56)).toBeCloseTo(0.035)
    expect(eventTimeSeconds(event, 60, 0.56)).toBeCloseTo(0.785)
    expect(eventDurationSeconds(event, 60)).toBe(0.5)
  })
})
