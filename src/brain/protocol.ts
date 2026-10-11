import type { PhraseScore, SessionRecipe } from '../music/types'
import type { BrainCheckpoint } from './checkpoint'
import type { CriticPart } from './critic'
import type { NeuronRole } from './circuit'

/** Per-neuron display data: soma position (8 nm voxels, X-Z projection used), role, and type. */
export interface BrainAtlas {
  ids: string[]
  types: (string | null)[]
  roles: NeuronRole[]
  /** Flattened [x, z] pairs; NaN when the neuron has no recorded position. */
  positions: Float32Array
  connections: number
  readoutNeurons: number
}

export interface BrainExperience {
  experience: BrainCheckpoint['experience']
  history: BrainCheckpoint['history']
  source: 'shipped' | 'saved' | 'fresh'
  trainedAt: string
  savedAt: string | null
}

export interface ComposedPhrase {
  id: string
  score: PhraseScore
  bananas: number
  /** groove, breakdown, or intro */
  section: string
  parts: Record<CriticPart, number>
  notes: string[]
  /** Rates of every neuron at the end of each beat, scaled to int8 (rate * 127). */
  frames: Int8Array
  composeMs: number
}

export type BrainRequest =
  | { type: 'initialize'; id: number; baseUrl: string }
  | { type: 'compose'; id: number; recipe: SessionRecipe; phraseIndex: number; fresh: boolean }
  | { type: 'adopt'; id: number; phraseId: string }
  | { type: 'banana'; id: number; phraseId: string }
  | { type: 'forget'; id: number }

export type BrainResponse =
  | { type: 'initialized'; id: number; atlas: BrainAtlas; state: BrainExperience }
  | { type: 'composed'; id: number; phrase: ComposedPhrase }
  | { type: 'adopted'; id: number; state: BrainExperience; learned: boolean }
  | { type: 'bananaReceived'; id: number; state: BrainExperience }
  | { type: 'forgotten'; id: number; state: BrainExperience }
  | { type: 'error'; id: number; message: string }

export interface BrainPort {
  postMessage(message: BrainRequest, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<BrainResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  terminate(): void
}
