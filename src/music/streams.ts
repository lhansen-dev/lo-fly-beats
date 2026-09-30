import { createRng, type Rng } from './rng'
import { MAPPING_VERSION } from './versions'

export function compositionPhraseIndex(variation: number, phraseIndex: number): number {
  return variation === 0 ? 0 : phraseIndex
}

export function compositionStreams(sessionSeed: number, phraseIndex: number): {
  traversal: Rng
  rhythm: Rng
  humanize: Rng
} {
  const prefix = `${sessionSeed}|${phraseIndex}|${MAPPING_VERSION}`
  return {
    traversal: createRng(`${prefix}|traversal`),
    rhythm: createRng(`${prefix}|rhythm`),
    humanize: createRng(`${prefix}|humanize`),
  }
}

export function animationRng(sessionSeed: number): Rng {
  return createRng(`${sessionSeed}|animation`)
}

export function jokesRng(sessionSeed: number): Rng {
  return createRng(`${sessionSeed}|jokes`)
}

export function bufferRng(name: string, sampleRate: number): Rng {
  return createRng(`buffer|${name}|${sampleRate}`)
}

export function seedHex(seed: number): string {
  return (seed >>> 0).toString(16).padStart(8, '0')
}
