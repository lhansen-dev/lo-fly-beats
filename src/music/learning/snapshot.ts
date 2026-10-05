import { z } from 'zod'
import { BASS_VOCABULARY } from './context'
import type { LearningSnapshot } from './types'

const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1024)
const cell = z.enum(BASS_VOCABULARY as [string, ...string[]])
const configuration = z.strictObject({
  selector: z.literal('reservoir-decoder'), modelVersion: counter, incomingWeightTotal: z.number(),
  retention: z.number(), inputScale: z.number(), maxExploration: z.number(), decoderVersion: counter,
  samplingTemperature: z.number(), reservoirSize: counter, recentActionLimit: counter, motifHistoryLimit: counter,
})
const schema = z.strictObject({
  parameters: z.strictObject({
    graphChecksum: z.string(), modelSeed: counter, configuration, learnerVersion: counter,
    inputVersion: counter, vocabularyVersion: counter,
    decoderWeights: z.array(z.number().min(-1e6).max(1e6)), trainingUpdateCount: counter, modelRevision: counter,
  }),
  runtime: z.strictObject({
    activations: z.array(z.number().min(-1).max(1)), previousBassAction: cell.nullable(),
    generationIndex: counter, contextBeatIndex: counter,
    recentActions: z.array(z.strictObject({ contextBeatIndex: counter, cellId: cell, forcedRest: z.boolean() })).max(8),
  }),
  recentMotifs: z.array(z.strictObject({
    generationIndex: counter, firstBeat: z.number().int().min(0).max(24).multipleOf(8),
    cells: z.array(cell).length(8), eligibleMask: z.array(z.boolean()).length(8),
  })).max(8),
  compatibility: z.strictObject({
    snapshotVersion: counter, learnerVersion: counter, accompanimentGraphChecksum: z.string(), mappingVersion: counter,
  }),
  recipeGeneration: counter, requestRevision: counter,
})

/** Validate untrusted storage against the fresh, verified model's complete identity. */
export function validateLearningSnapshot(value: unknown, template: LearningSnapshot): LearningSnapshot | null {
  const parsed = schema.safeParse(value)
  if (!parsed.success) return null
  const snapshot = parsed.data as LearningSnapshot
  const p = snapshot.parameters
  const expected = template.parameters
  if (p.graphChecksum !== expected.graphChecksum || p.modelSeed !== expected.modelSeed
    || p.learnerVersion !== expected.learnerVersion || p.inputVersion !== expected.inputVersion
    || p.vocabularyVersion !== expected.vocabularyVersion
    || Object.keys(expected.configuration).some(key => p.configuration[key as keyof typeof p.configuration]
      !== expected.configuration[key as keyof typeof expected.configuration])
    || Object.keys(template.compatibility).some(key => snapshot.compatibility[key as keyof typeof snapshot.compatibility]
      !== template.compatibility[key as keyof typeof template.compatibility])
    || p.decoderWeights.length !== expected.decoderWeights.length
    || snapshot.runtime.activations.length !== expected.configuration.reservoirSize) return null
  const { recentActions, contextBeatIndex, previousBassAction } = snapshot.runtime
  if (recentActions.some((action, i) => action.contextBeatIndex !== contextBeatIndex - recentActions.length + i
    || (action.forcedRest && action.cellId !== 'rest'))
    || (recentActions.length > 0 && recentActions.at(-1)!.cellId !== previousBassAction)
    || snapshot.recentMotifs.some(motif => motif.generationIndex >= snapshot.runtime.generationIndex
      || motif.cells.some((id, i) => !motif.eligibleMask[i] && id !== 'rest'))) return null
  // Preserve the parent snapshot's property ordering across the existing adoption gate.
  return structuredClone(value) as LearningSnapshot
}
