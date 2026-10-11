import { z } from 'zod'
import { CRITIC_VERSION } from './critic'
import { LEARNING_CONFIGURATION } from './learn'
import { BRAIN_CONFIGURATION, type BrainModel } from './model'
import { OUTPUT_SIZE } from './vocabulary'
import { readoutWidth } from './perform'
import { TUTOR_VERSION } from './tutor'

/** Bump when the vocabulary, senses, readout layout, or dynamics change shape or meaning. */
export const BRAIN_VERSION = 3
export const BRAIN_ID = 'fly-v1'

const historyPoint = z.strictObject({
  stage: z.enum(['school', 'practice', 'listening']),
  phrases: z.number().int().nonnegative(),
  bananas: z.number().min(0).max(10),
})

export const checkpointSchema = z.strictObject({
  schemaVersion: z.literal(1),
  brainId: z.string(),
  brainVersion: z.literal(BRAIN_VERSION),
  circuitChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  modelSeed: z.number().int(),
  modelVersion: z.number().int(),
  connectivity: z.enum(['anatomical', 'source-permuted', 'zero']),
  readoutNeurons: z.number().int().positive(),
  outputs: z.number().int().positive(),
  tutorVersion: z.number().int(),
  criticVersion: z.number().int(),
  learningVersion: z.number().int(),
  /** Counts of what this fly has done; they only ever grow. */
  experience: z.strictObject({
    schoolLessons: z.number().int().nonnegative(),
    practicePhrases: z.number().int().nonnegative(),
    listeningPhrases: z.number().int().nonnegative(),
    bananasFromListeners: z.number().int().nonnegative(),
  }),
  history: z.array(historyPoint).max(400),
  trainedAt: z.string(),
  readout: z.strictObject({
    encoding: z.literal('int8-row-scaled-v1'),
    file: z.string(),
    bytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
})

export type BrainCheckpoint = z.infer<typeof checkpointSchema>
export type CheckpointMetadata = Omit<BrainCheckpoint, 'readout'>

export interface BrainIdentity {
  brainVersion: number
  circuitChecksum: string
  modelSeed: number
  modelVersion: number
  connectivity: string
  readoutNeurons: number
  outputs: number
}

export function checkpointMatches(checkpoint: BrainIdentity, model: BrainModel): boolean {
  return checkpoint.brainVersion === BRAIN_VERSION && checkpoint.circuitChecksum === model.circuit.checksum
    && checkpoint.modelSeed === model.seed && checkpoint.modelVersion === BRAIN_CONFIGURATION.modelVersion
    && checkpoint.connectivity === model.connectivity && checkpoint.readoutNeurons === model.readoutNeurons.length
    && checkpoint.outputs === OUTPUT_SIZE
}

export function checkpointMetadata(model: BrainModel, experience: BrainCheckpoint['experience'], history: BrainCheckpoint['history'], trainedAt: string): CheckpointMetadata {
  return {
    schemaVersion: 1, brainId: BRAIN_ID, brainVersion: BRAIN_VERSION, circuitChecksum: model.circuit.checksum,
    modelSeed: model.seed, modelVersion: BRAIN_CONFIGURATION.modelVersion, connectivity: model.connectivity,
    readoutNeurons: model.readoutNeurons.length, outputs: OUTPUT_SIZE, tutorVersion: TUTOR_VERSION,
    criticVersion: CRITIC_VERSION, learningVersion: LEARNING_CONFIGURATION.version, experience, history, trainedAt,
  }
}

/**
 * Each readout row is stored as one float32 scale followed by int8 weights. Quantization changes
 * logits by at most half a step per weight; the shipped fly is evaluated after this round trip.
 */
export function encodeReadout(readout: Float32Array, width: number): Uint8Array {
  if (readout.length % width !== 0) throw new Error('Readout width mismatch')
  const rows = readout.length / width
  const bytes = new Uint8Array(rows * (4 + width))
  const view = new DataView(bytes.buffer)
  for (let row = 0; row < rows; row++) {
    let maximum = 0
    for (let column = 0; column < width; column++) maximum = Math.max(maximum, Math.abs(readout[row * width + column]!))
    const scale = maximum / 127
    const offset = row * (4 + width)
    view.setFloat32(offset, scale, true)
    for (let column = 0; column < width; column++) {
      view.setInt8(offset + 4 + column, scale === 0 ? 0 : Math.round(readout[row * width + column]! / scale))
    }
  }
  return bytes
}

export function decodeReadout(bytes: Uint8Array, model: BrainModel): Float32Array {
  const width = readoutWidth(model)
  if (bytes.byteLength !== OUTPUT_SIZE * (4 + width)) throw new Error('Readout size does not match this brain')
  const readout = new Float32Array(OUTPUT_SIZE * width)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let row = 0; row < OUTPUT_SIZE; row++) {
    const offset = row * (4 + width)
    const scale = view.getFloat32(offset, true)
    if (!Number.isFinite(scale) || scale < 0) throw new Error('Invalid readout scale')
    for (let column = 0; column < width; column++) readout[row * width + column] = view.getInt8(offset + 4 + column) * scale
  }
  return readout
}
