import { loadBrainFromDisk } from '../../../scripts/brain/load'
import { createBrainModel, type BrainModel, type Connectivity } from '../../../src/brain/model'
import type { BrainCircuit } from '../../../src/brain/circuit'

let circuit: Promise<BrainCircuit> | null = null
const models = new Map<Connectivity, Promise<BrainModel>>()

export function songCircuit(): Promise<BrainCircuit> {
  return circuit ??= loadBrainFromDisk().then(result => result.circuit)
}

export function songModel(connectivity: Connectivity = 'anatomical'): Promise<BrainModel> {
  let model = models.get(connectivity)
  if (!model) {
    model = songCircuit().then(loaded => createBrainModel(loaded, 1, connectivity))
    models.set(connectivity, model)
  }
  return model
}
