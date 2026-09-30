import { createRng } from '../../../src/music/rng'
import type { Rng } from '../../../src/music/rng'

export function scriptedRng(floats: readonly number[]): Rng & { floatsConsumed: () => number } {
  const fallback = createRng('scripted-fallback')
  let consumed = 0
  return {
    float: () => floats[consumed++] ?? fallback.float(),
    int: maxExclusive => Math.floor((floats[consumed++] ?? fallback.float()) * maxExclusive),
    pick: items => {
      if (items.length === 0) throw new RangeError('Cannot pick from an empty array')
      const value = floats[consumed++] ?? fallback.float()
      return items[Math.floor(value * items.length)]!
    },
    floatsConsumed: () => consumed,
  }
}
