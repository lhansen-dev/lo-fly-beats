import type { BassCellId } from '../patterns'
import type { LearningPhraseInput } from './types'
import { createRng } from '../rng'

export const CURRICULUM_VERSION = 2
export const TEACHING_EXAMPLES: readonly Readonly<{
  id: string; cells: readonly BassCellId[]; weight: number; provenance: string
}>[] = Object.freeze([
  { id: 'original-v1', weight: 32, provenance: 'Original Lo-fly beats two-bar bass exercise, authored October 5, 2026.',
    cells: ['root-hold', 'and-root', 'root-push', 'fifth', 'root-short', 'rest', 'root-octave', 'approach'] },
  { id: 'sparse-a-v1', weight: 1, provenance: 'Authored substitution: silence instead of the first fifth.',
    cells: ['root-hold', 'and-root', 'root-push', 'rest', 'root-short', 'rest', 'root-octave', 'approach'] },
  { id: 'sparse-b-v1', weight: 1, provenance: 'Authored substitutions: short first root and silent final approach.',
    cells: ['root-short', 'and-root', 'root-push', 'fifth', 'root-short', 'rest', 'root-octave', 'rest'] },
  { id: 'sparse-c-v1', weight: 1, provenance: 'Authored substitutions: silent pickup and short final strong root.',
    cells: ['root-hold', 'rest', 'root-push', 'fifth', 'root-short', 'rest', 'root-short', 'approach'] },
].map(example => Object.freeze({ ...example, cells: Object.freeze(example.cells as BassCellId[]) })))

/** Labels belong to training/evaluation data, never to the inference API. */
export interface TeachingContext<T extends LearningPhraseInput = LearningPhraseInput> {
  id: string
  plan: T
  cells: readonly BassCellId[]
}

export function teachingContexts<T extends LearningPhraseInput>(plans: readonly T[]): TeachingContext<T>[] {
  const contexts = plans.flatMap(plan => TEACHING_EXAMPLES.flatMap(example =>
    Array.from({ length: example.weight }, () => ({
      id: `${example.id}|${plan.recipe.presetId}|${plan.recipe.sessionSeed}|${plan.phraseIndex}`, plan, cells: example.cells,
    }))))
  const rng = createRng(`curriculum-order|${CURRICULUM_VERSION}`)
  for (let index = contexts.length - 1; index > 0; index--) {
    const other = rng.int(index + 1)
    ;[contexts[index], contexts[other]] = [contexts[other]!, contexts[index]!]
  }
  return contexts
}

export function originalContexts<T extends LearningPhraseInput>(plans: readonly T[]): TeachingContext<T>[] {
  return plans.map(plan => ({ id: `original-v1|${plan.recipe.presetId}|${plan.recipe.sessionSeed}|${plan.phraseIndex}`,
    plan, cells: TEACHING_EXAMPLES[0]!.cells }))
}

export const TRAINING_CONFIGURATION = Object.freeze({
  version: 1,
  curriculumVersion: CURRICULUM_VERSION,
  learningRate: 0.03,
  l2: 0.0001,
  gradientNormCap: 1,
  maxUpdates: 20_000,
  chunkUpdates: 128,
  teacherForcingUpdates: 4_000,
  rolloutVariation: 1,
})
