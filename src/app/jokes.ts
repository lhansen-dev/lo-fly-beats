import { jokesRng } from '../music/streams'

export const JOKES = [
  'All systems operational. Banana unavailable.',
  'Homework progress: still on question one.',
  'Banana status: structurally concerning.',
  'Six sleeves. Zero pockets.',
  'Studying the window. For science.',
  'Now reviewing: the same window, again.',
] as const

export const JOKE_PHRASE_INTERVAL = 3
export const JOKE_CHANCE = 0.5

export function isJokePhrase(phraseIndex: number): boolean {
  return Number.isInteger(phraseIndex) && phraseIndex >= 0 && phraseIndex % JOKE_PHRASE_INTERVAL === 2
}

export function selectJoke(sessionSeed: number, phraseIndex: number): string | null {
  if (!isJokePhrase(phraseIndex)) return null

  const rng = jokesRng(sessionSeed)
  const slot = (phraseIndex - 2) / JOKE_PHRASE_INTERVAL
  for (let earlier = 0; earlier < slot; earlier++) {
    rng.float()
    rng.int(JOKES.length)
  }
  return rng.float() < JOKE_CHANCE ? JOKES[rng.int(JOKES.length)] : null
}
