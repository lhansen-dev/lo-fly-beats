import { createRng } from '../music/rng'
import type { BrainCircuit } from './circuit'
import { INPUT_SIZE, senseInputs } from './senses'

/**
 * Engineering choices for the rate model. The anatomy supplies who connects to whom, how many
 * synapses, and the predicted transmitter; leak, gain, bias, and input weights are modeled.
 */
export const BRAIN_CONFIGURATION = Object.freeze({
  modelVersion: 1,
  /** Each incoming row is scaled to unit norm times this gain before spectral scaling. */
  gain: 1,
  normalization: 'l2' as 'l1' | 'l2',
  /** Recurrent weights are rescaled to this spectral radius (echo-state convention); null keeps the row gain. */
  spectralRadius: 1 as number | null,
  /** Per-neuron leak rates are log-uniform between these: fast enough to follow sixteenths, slow enough to remember a beat. */
  leakMin: 0.3,
  leakMax: 0.95,
  biasScale: 0.15,
  inputScale: 1.2,
  /** Musical decisions are read only from the song side, never directly from the ear. */
  readoutRoles: Object.freeze(['premotor', 'song', 'motor'] as const),
  transmitterSigns: Object.freeze({
    acetylcholine: 1, gaba: -1, glutamate: -1, histamine: -1,
    dopamine: 0.5, serotonin: 0.5, octopamine: 0.5, tyramine: 0.5,
  } as Record<string, number>),
})

export type Connectivity = 'anatomical' | 'source-permuted' | 'zero'

export interface BrainModel {
  circuit: BrainCircuit
  seed: number
  connectivity: Connectivity
  size: number
  /** Incoming rows: rowStart[target]..rowStart[target+1] index col/weight. */
  rowStart: Int32Array
  col: Int32Array
  weight: Float32Array
  leak: Float32Array
  bias: Float32Array
  /** Neuron-major input weights; only ear and wing-sense neurons receive sensation. */
  inputWeights: Float32Array
  earNeurons: Int32Array
  /** 1 for neurons that receive sound directly. */
  hearing: Uint8Array
  /** Neurons whose rates feed the decoder, in stable index order. */
  readoutNeurons: Int32Array
  /** Each readout neuron is heard relative to its own typical rate and range. */
  featureMean: Float32Array
  featureScale: Float32Array
}

const CALIBRATION_STEPS = 768

/** Run the brain on the clock and seeded random sounds to learn each readout neuron's range. */
function calibrate(model: Omit<BrainModel, 'featureMean' | 'featureScale'>): { mean: Float32Array; scale: Float32Array } {
  const rng = createRng(`brain|${model.seed}|calibration`)
  let state = new Float32Array(model.size)
  let next = new Float32Array(model.size)
  const inputs = new Float32Array(INPUT_SIZE)
  const count = model.readoutNeurons.length
  const sum = new Float64Array(count)
  const squares = new Float64Array(count)
  const warmup = 128
  for (let step = 0; step < CALIBRATION_STEPS + warmup; step++) {
    const pick = (chance: number) => rng.float() < chance ? 1 : 0
    senseInputs(step, {
      kick: pick(0.15), snare: pick(0.12), hat: pick(0.45) * 0.6, bassOnset: pick(0.15), bassPitch: rng.float() < 0.7 ? rng.float() : -1,
      keysOnset: pick(0.08), leadOnset: pick(0.2), leadPitch: rng.float() < 0.6 ? rng.float() : -1, chordRing: Math.floor(step / 32) % 6, section: Math.floor(step / 128) % 3, habituation: (Math.floor(step / 128) % 5) / 4,
    }, inputs)
    stepBrain(model as BrainModel, state, inputs, next)
    ;[state, next] = [next, state]
    if (step < warmup) continue
    for (let index = 0; index < count; index++) {
      const value = state[model.readoutNeurons[index]!]!
      sum[index] = sum[index]! + value
      squares[index] = squares[index]! + value * value
    }
  }
  const mean = new Float32Array(count)
  const scale = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const mu = sum[index]! / CALIBRATION_STEPS
    mean[index] = mu
    scale[index] = 1 / Math.max(1e-4, Math.sqrt(Math.max(0, squares[index]! / CALIBRATION_STEPS - mu * mu)))
  }
  return { mean, scale }
}

export function transmitterSign(nt: string | null): number {
  if (nt === null) return 1
  const sign = BRAIN_CONFIGURATION.transmitterSigns[nt]
  if (sign === undefined) throw new Error(`Unknown transmitter ${nt}`)
  return sign
}

export interface BrainOptions {
  readoutRoles?: readonly string[]
  gain?: number
  inputScale?: number
  normalization?: 'l1' | 'l2'
  /** When set, rescale recurrent weights so their spectral radius matches this target. */
  spectralRadius?: number
  leakMin?: number
  leakMax?: number
}

/** Deterministic power-iteration estimate of the recurrent matrix's spectral radius. */
export function estimateSpectralRadius(size: number, rowStart: Int32Array, col: Int32Array, weight: Float32Array, iterations = 400): number {
  const rng = createRng('brain|spectral-radius')
  let vector = Float64Array.from({ length: size }, () => rng.float() - 0.5)
  let logGrowth = 0
  let counted = 0
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = new Float64Array(size)
    for (let row = 0; row < size; row++) {
      let sum = 0
      for (let slot = rowStart[row]!; slot < rowStart[row + 1]!; slot++) sum += weight[slot]! * vector[col[slot]!]!
      next[row] = sum
    }
    let norm = 0
    for (const value of next) norm += value * value
    norm = Math.sqrt(norm)
    if (norm === 0) return 0
    // Average growth over the second half smooths oscillating complex-conjugate leading modes.
    if (iteration >= iterations / 2) { logGrowth += Math.log(norm); counted++ }
    for (let row = 0; row < size; row++) next[row] = next[row]! / norm
    vector = next
  }
  return Math.exp(logGrowth / counted)
}

export function createBrainModel(circuit: BrainCircuit, seed = 1, connectivity: Connectivity = 'anatomical', options: BrainOptions = {}): BrainModel {
  const gain = options.gain ?? BRAIN_CONFIGURATION.gain
  const inputScale = options.inputScale ?? BRAIN_CONFIGURATION.inputScale
  const readoutRoles = options.readoutRoles ?? BRAIN_CONFIGURATION.readoutRoles
  if (!Number.isSafeInteger(seed)) throw new Error('Invalid brain seed')
  const size = circuit.neurons.length
  const edges = circuit.source.length
  let sources = circuit.source
  if (connectivity === 'source-permuted') {
    // Relabel presynaptic partners only; each row keeps its count, weights, and target.
    const rng = createRng(`brain|${seed}|source-permutation`)
    const permutation = Int32Array.from({ length: size }, (_, index) => index)
    for (let index = size - 1; index > 0; index--) {
      const other = rng.int(index + 1)
      ;[permutation[index], permutation[other]] = [permutation[other]!, permutation[index]!]
    }
    sources = circuit.source.map(source => permutation[source]!)
  }
  const counts = new Int32Array(size + 1)
  for (let edge = 0; edge < edges; edge++) counts[circuit.target[edge]! + 1]!++
  const rowStart = new Int32Array(size + 1)
  for (let row = 0; row < size; row++) rowStart[row + 1] = rowStart[row]! + counts[row + 1]!
  const fill = rowStart.slice(0, size)
  const col = new Int32Array(edges)
  const weight = new Float32Array(edges)
  for (let edge = 0; edge < edges; edge++) {
    const target = circuit.target[edge]!
    const slot = fill[target]!++
    const source = sources[edge]!
    col[slot] = source
    weight[slot] = connectivity === 'zero' ? 0 : transmitterSign(circuit.neurons[source]!.nt) * Math.log1p(circuit.synapses[edge]!)
  }
  const normalization = options.normalization ?? BRAIN_CONFIGURATION.normalization
  for (let row = 0; row < size; row++) {
    let total = 0
    for (let slot = rowStart[row]!; slot < rowStart[row + 1]!; slot++) {
      total += normalization === 'l1' ? Math.abs(weight[slot]!) : weight[slot]! * weight[slot]!
    }
    if (total === 0) continue
    if (normalization === 'l2') total = Math.sqrt(total)
    for (let slot = rowStart[row]!; slot < rowStart[row + 1]!; slot++) weight[slot] = weight[slot]! / total * gain
  }
  const target = options.spectralRadius ?? BRAIN_CONFIGURATION.spectralRadius
  if (target !== null && connectivity !== 'zero') {
    const radius = estimateSpectralRadius(size, rowStart, col, weight)
    if (radius > 0) for (let slot = 0; slot < edges; slot++) weight[slot] = weight[slot]! * target / radius
  }
  const rng = createRng(`brain|${seed}|parameters`)
  const leak = new Float32Array(size)
  const bias = new Float32Array(size)
  const logMin = Math.log(options.leakMin ?? BRAIN_CONFIGURATION.leakMin)
  const logMax = Math.log(options.leakMax ?? BRAIN_CONFIGURATION.leakMax)
  for (let neuron = 0; neuron < size; neuron++) {
    leak[neuron] = Math.exp(logMin + (logMax - logMin) * rng.float())
    bias[neuron] = (2 * rng.float() - 1) * BRAIN_CONFIGURATION.biasScale
  }
  const ear: number[] = []
  const hearing = new Uint8Array(size)
  const inputWeights = new Float32Array(size * INPUT_SIZE)
  circuit.neurons.forEach((neuron, index) => {
    if (neuron.role !== 'ear' && neuron.role !== 'wing') return
    ear.push(index)
    hearing[index] = 1
    for (let input = 0; input < INPUT_SIZE; input++) {
      inputWeights[index * INPUT_SIZE + input] = (2 * rng.float() - 1) * inputScale
    }
  })
  const partial = {
    circuit, seed, connectivity, size, rowStart, col, weight, leak, bias, inputWeights, earNeurons: Int32Array.from(ear), hearing,
    readoutNeurons: Int32Array.from(circuit.neurons.flatMap((neuron, index) =>
      readoutRoles.includes(neuron.role) ? [index] : [])),
  }
  const { mean, scale } = calibrate(partial)
  return Object.freeze({ ...partial, featureMean: mean, featureScale: scale })
}

/** One synchronous update per sixteenth note. Reads `state`, writes `next`; they must differ. */
export function stepBrain(model: BrainModel, state: Float32Array, inputs: Float32Array, next: Float32Array): void {
  if (state === next) throw new Error('Brain step requires separate state buffers')
  const { size, rowStart, col, weight, leak, bias, inputWeights, hearing } = model
  for (let neuron = 0; neuron < size; neuron++) {
    let drive = bias[neuron]!
    for (let slot = rowStart[neuron]!; slot < rowStart[neuron + 1]!; slot++) drive += weight[slot]! * state[col[slot]!]!
    if (hearing[neuron]) {
      const offset = neuron * INPUT_SIZE
      for (let input = 0; input < INPUT_SIZE; input++) drive += inputWeights[offset + input]! * inputs[input]!
    }
    const rate = leak[neuron]!
    next[neuron] = (1 - rate) * state[neuron]! + rate * Math.tanh(drive)
  }
}
