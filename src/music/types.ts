import type { PresetId } from '../presets/types'

export type WalkStep =
  | { beat: number; kind: 'start' | 'restart'; neuronId: string }
  | { beat: number; kind: 'edge'; neuronId: string; from: string; synapseCount: number; probability: number }
  | { beat: number; kind: 'rest'; neuronId: null }

export type Layer = 'drums' | 'bass' | 'keys'
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
}
