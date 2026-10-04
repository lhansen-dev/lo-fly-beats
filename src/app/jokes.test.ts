// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { JOKES, isJokePhrase, selectJoke } from './jokes'

describe('status jokes', () => {
  it('contains exactly six unique short jokes', () => {
    expect(JOKES).toHaveLength(6)
    expect(new Set(JOKES).size).toBe(6)
    expect(JOKES.every((joke) => joke.length < 60)).toBe(true)
  })

  it('is deterministic for each seed and phrase', () => {
    for (const seed of [1, 2]) {
      for (let phrase = 0; phrase < 300; phrase++) {
        expect(selectJoke(seed, phrase)).toBe(selectJoke(seed, phrase))
      }
    }
  })

  it('produces different schedules for different seeds', () => {
    const schedule = (seed: number) => Array.from({ length: 300 }, (_, phrase) => selectJoke(seed, phrase))
    expect(schedule(1)).not.toEqual(schedule(2))
  })

  it('only selects jokes on eligible phrases without adjacent joke phrases', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let previousJokePhrase = -Infinity
      for (let phrase = 0; phrase < 300; phrase++) {
        const joke = selectJoke(seed, phrase)
        if (joke !== null) {
          expect(phrase % 3).toBe(2)
          expect(JOKES).toContain(joke)
          expect(phrase - previousJokePhrase).toBeGreaterThanOrEqual(3)
          previousJokePhrase = phrase
        }
      }
    }
  })

  it('includes jokes for seed 1 and rejects invalid or ineligible phrases', () => {
    expect(Array.from({ length: 300 }, (_, phrase) => selectJoke(1, phrase)).some((joke) => joke !== null)).toBe(true)
    expect(selectJoke(1, -1)).toBeNull()
    expect(selectJoke(1, 2.5)).toBeNull()
    expect(selectJoke(1, 0)).toBeNull()
    expect(selectJoke(1, 1)).toBeNull()
    expect(isJokePhrase(-1)).toBe(false)
    expect(isJokePhrase(2.5)).toBe(false)
  })
})
