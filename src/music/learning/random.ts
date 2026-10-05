import { createRng, type Rng } from '../rng'
import { LEARNER_VERSION } from './versions'

export function learningRng(modelSeed: number, generationIndex: number, purpose: string): Rng {
  return createRng(`learning|${LEARNER_VERSION}|${modelSeed}|${generationIndex}|${purpose}`)
}
