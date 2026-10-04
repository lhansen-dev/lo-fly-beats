import { describe, expect, it } from 'vitest'
import { effectiveAnimationEnabled, sceneClassName } from './animationMode'

describe('effectiveAnimationEnabled', () => {
  it.each([
    [null, false, true],
    [null, true, false],
    [true, true, true],
    [false, false, false],
  ] as const)('returns expected result for stored=%s and reducedMotion=%s', (stored, reduced, expected) => {
    expect(effectiveAnimationEnabled(stored, reduced)).toBe(expected)
  })
})

describe('sceneClassName', () => {
  it.each([
    [false, false, 'scene'],
    [true, false, 'scene scene--still'],
    [false, true, 'scene scene--paused'],
    [true, true, 'scene scene--still scene--paused'],
  ] as const)('formats still=%s and paused=%s', (still, paused, expected) => {
    expect(sceneClassName({ still, paused })).toBe(expected)
  })
})
