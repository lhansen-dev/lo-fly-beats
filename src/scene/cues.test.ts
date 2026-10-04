import { describe, expect, it } from 'vitest'
import { createCueState, nextBlinkDelayMs, phraseCue, rainTimings, stepCue } from './cues'
import type { Rng } from '../music/rng'

function sequenceRng(values: number[]): { rng: Rng; draws: () => number } {
  let index = 0
  return {
    rng: {
      float: () => values[index++] ?? 0,
      int: () => 0,
      pick: <T>(items: readonly T[]) => items[0]!,
    },
    draws: () => index,
  }
}

describe('scene cues', () => {
  it('emits bob cues only on every fourth step and does not draw randomness', () => {
    const source = sequenceRng([0.5])
    const state = createCueState(1, source.rng)
    expect(stepCue(state, { phraseIndex: 0, stepInPhrase: 1, bar: 0, beat: 0 })).toEqual({ bob: null })
    expect(stepCue(state, { phraseIndex: 0, stepInPhrase: 4, bar: 0, beat: 0 })).toEqual({ bob: 'strong' })
    expect(stepCue(state, { phraseIndex: 0, stepInPhrase: 8, bar: 0, beat: 1 })).toEqual({ bob: 'soft' })
    expect(source.draws()).toBe(0)
  })

  it('applies phrase cooldown and shifts the rub gap on numbering restart', () => {
    const source = sequenceRng([0.1, 0.1])
    const state = createCueState(1, source.rng)
    expect(phraseCue(state, 0)).toEqual({ rub: false })
    expect(phraseCue(state, 1)).toEqual({ rub: true })
    expect(phraseCue(state, 2)).toEqual({ rub: false })
    expect(phraseCue(state, 3)).toEqual({ rub: false })
    expect(source.draws()).toBe(1)
    expect(phraseCue(state, 0)).toEqual({ rub: false })
    expect(state.lastRubPhrase).toBe(-3)
    expect(source.draws()).toBe(1)
  })

  it('generates blink and repeatable rain timings from animation RNG', () => {
    const source = sequenceRng([0, 1])
    const state = createCueState(3, source.rng)
    expect(nextBlinkDelayMs(state)).toBe(3000)
    expect(nextBlinkDelayMs(state)).toBe(7000)
    expect(rainTimings(123, 4)).toEqual(rainTimings(123, 4))
    expect(rainTimings(123, 0)).toEqual([])
  })
})
