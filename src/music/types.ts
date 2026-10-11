import type { PresetId } from '../presets/types'
import type { BassCellId } from './patterns'
import type { LearningProvenance } from './learning/types'
import type { BrainProvenance } from '../brain/arrange'

export type WalkStep =
  | { beat: number; kind: 'start' | 'restart'; neuronId: string }
  | { beat: number; kind: 'edge'; neuronId: string; from: string; synapseCount: number; probability: number }
  | { beat: number; kind: 'rest'; neuronId: null }

export type Layer = 'drums' | 'bass' | 'keys' | 'lead'
export type DrumVoice = 'kick' | 'snare' | 'hat'

export interface SessionRecipe {
  recipeVersion: 1
  presetId: PresetId
  sessionSeed: number
  variation: number
  tempoBpm: number
}

export interface NoteEvent {
  layer: Layer
  step: number
  microOffset: number
  durationSteps: number
  midi: number | null
  drum: DrumVoice | null
  velocity: number
  traceBeat: number | null
}

export interface ChordSlot {
  bar: 0 | 2 | 4 | 6
  traceBeat: number
  ringIndex: number
  ringStepped: boolean
  symbol: string
  rootMidi: number
  voicing: number[]
}

export type TraceStep = WalkStep & {
  bar: number
  beatInBar: number
  neuronType: string | null
  uses: string[]
}

/** Unhumanized accompaniment and legacy bass choices; rendering never changes the plan. */
export interface PhrasePlan {
  recipe: SessionRecipe
  phraseIndex: number
  compositionPhraseIndex: number
  graphChecksum: string
  chords: ChordSlot[]
  trace: TraceStep[]
  accompaniment: NoteEvent[]
  bassCells: (BassCellId | null)[]
  fill: boolean
}

export interface BassOverrides {
  /** One action per trace beat. Traversal rests require null or the silent 'rest' cell. */
  cells: readonly (BassCellId | null)[]
  provenance?: LearningProvenance
}

export interface PhraseScore {
  scoreVersion: 1
  mappingVersion: number
  presetId: PresetId
  presetVersion: number
  sessionSeed: number
  phraseIndex: number
  compositionPhraseIndex: number
  variation: number
  graphChecksum: string
  bars: 8
  stepsPerBar: 16
  chords: ChordSlot[]
  events: NoteEvent[]
  trace: TraceStep[]
  fill: boolean
  learning?: LearningProvenance
  /** Present when the fly's brain composed every layer of this phrase. */
  brain?: BrainProvenance
}
