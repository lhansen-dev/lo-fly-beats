import { INPUT_SIZE } from './context'
import type { ReservoirGraph } from './graph'
import { learningRng } from './random'
import { RESERVOIR_CONFIGURATION } from './versions'

export interface ReservoirModel {
  graph: ReservoirGraph
  modelSeed: number
  /** Neuron-major rows over the versioned musical input features. */
  inputWeights: readonly number[]
}

export function createReservoirModel(graph: ReservoirGraph, modelSeed = 1): ReservoirModel {
  if (!Number.isSafeInteger(modelSeed)) throw new Error('Invalid model seed')
  const rng = learningRng(modelSeed, 0, 'input-weights')
  const inputWeights = Array.from({ length: graph.neuronIds.length * INPUT_SIZE },
    () => (2 * rng.float() - 1) * RESERVOIR_CONFIGURATION.inputScale)
  return Object.freeze({ graph, modelSeed, inputWeights: Object.freeze(inputWeights) })
}

/** One synchronous beat update. Every row reads the old array, never a partial update. */
export function stepReservoir(model: ReservoirModel, activations: readonly number[], inputs: readonly number[]): number[] {
  const size = model.graph.neuronIds.length
  if (activations.length !== size || inputs.length !== INPUT_SIZE || model.inputWeights.length !== size * INPUT_SIZE) {
    throw new Error('Incompatible reservoir dimensions')
  }
  if (activations.some(value => !Number.isFinite(value) || Math.abs(value) > 1)
    || inputs.some(value => !Number.isFinite(value))) throw new Error('Invalid reservoir state or input')
  const next = Array<number>(size)
  const retention = RESERVOIR_CONFIGURATION.retention
  for (let target = 0; target < size; target++) {
    let drive = 0
    for (const edge of model.graph.incoming[target]!) drive += edge.weight * activations[edge.sourceIndex]!
    const offset = target * INPUT_SIZE
    for (let input = 0; input < INPUT_SIZE; input++) drive += model.inputWeights[offset + input]! * inputs[input]!
    next[target] = retention * activations[target]! + (1 - retention) * Math.tanh(drive)
    if (!Number.isFinite(next[target])) throw new Error('Non-finite reservoir activity')
  }
  return next
}
