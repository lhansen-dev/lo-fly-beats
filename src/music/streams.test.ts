import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { compositionPhraseIndex, compositionStreams, seedHex } from './streams'
import { MAPPING_VERSION } from './versions'

describe('random stream derivation', () => {
  it('formats unsigned seeds and reuses phrase zero at zero variation', () => {
    expect(seedHex(1)).toBe('00000001')
    expect(seedHex(0xdeadbeef)).toBe('deadbeef')
    expect(compositionPhraseIndex(0, 7)).toBe(0)
    expect(compositionPhraseIndex(0.3, 7)).toBe(7)
  })

  it('derives the traversal stream from the documented seed text', () => {
    const expected = createRng(`1|0|${MAPPING_VERSION}|traversal`)
    const actual = compositionStreams(1, compositionPhraseIndex(0, 0)).traversal
    expect(Array.from({ length: 3 }, () => actual.float())).toEqual(
      Array.from({ length: 3 }, () => expected.float()),
    )
  })
})
