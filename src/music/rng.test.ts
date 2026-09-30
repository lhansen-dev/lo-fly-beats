import { describe, expect, it } from 'vitest'
import { createRng, fnv1a32, mulberry32 } from './rng'

describe('deterministic random number generator', () => {
  it('matches every FNV-1a and Mulberry32 reference vector', () => {
    expect(fnv1a32('')).toBe(2166136261)
    expect(fnv1a32('a')).toBe(3826002220)
    expect(fnv1a32('lofly')).toBe(1946705213)
    expect(fnv1a32('MBON11')).toBe(3910212617)
    expect(fnv1a32('1|0|1|traversal')).toBe(488098365)
    expect(Array.from({ length: 3 }, mulberry32(1))).toEqual([
      0.6270739405881613,
      0.002735721180215478,
      0.5274470399599522,
    ])
    expect(Array.from({ length: 3 }, mulberry32(0xdeadbeef))).toEqual([
      0.9413696140982211,
      0.26719574979506433,
      0.772033357527107,
    ])
  })

  it('keeps integers in range and rejects picking from an empty array', () => {
    const rng = createRng('range-check')
    for (let i = 0; i < 1000; i++) {
      expect(rng.int(7)).toBeGreaterThanOrEqual(0)
      expect(rng.int(7)).toBeLessThan(7)
    }
    expect(() => rng.pick([])).toThrow(RangeError)
  })

  it('repeats for identical seed texts and differs for different texts', () => {
    const sequence = (seedText: string) => {
      const rng = createRng(seedText)
      return Array.from({ length: 8 }, () => rng.float())
    }
    expect(sequence('same seed')).toEqual(sequence('same seed'))
    expect(sequence('same seed')).not.toEqual(sequence('different seed'))
  })
})
