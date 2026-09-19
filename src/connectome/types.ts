import type { z } from 'zod'
import type { circuitSchema, manifestSchema } from './schema'

export type CircuitManifest = z.infer<typeof manifestSchema>
export type CircuitFile = z.infer<typeof circuitSchema>

export interface Neuron {
  id: string
  type: string | null
  instance: string | null
  class: string | null
  superclass: string | null
  somaSide: string | null
}

export interface Connection {
  source: string
  target: string
  synapseCount: number
}

export interface OutEdge {
  target: string
  synapseCount: number
}

export interface CircuitGraph {
  manifest: CircuitManifest
  checksum: string
  neurons: ReadonlyMap<string, Neuron>
  outgoing: ReadonlyMap<string, readonly OutEdge[]>
  startNeuronIds: readonly string[]
}

export type CircuitErrorCode = 'network' | 'checksum' | 'schema' | 'integrity'

export class CircuitError extends Error {
  readonly code: CircuitErrorCode

  constructor(code: CircuitErrorCode, message: string) {
    super(message)
    this.name = 'CircuitError'
    this.code = code
  }
}
