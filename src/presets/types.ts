import type { DrumVoice } from '../music/types'

export type PresetId = 'rainy-windowsill' | 'overripe-2am' | 'fruit-bowl-finals'
export type ChordQualityId = 'm9' | 'm7add11' | 'maj9' | 'maj7sharp11' | 'dom9' | 'dom7sus4'

export interface ChordDef {
  symbol: string
  root: number
  quality: ChordQualityId
}

export type DrumHits = Record<DrumVoice, ReadonlyArray<readonly [step: number, velocity: number]>>

export interface PresetDefinition {
  id: PresetId
  version: number
  name: string
  keyName: string
  tempoBpm: number
  swing: number
  chordRing: readonly ChordDef[]
  keysRange: { low: number; center: number; high: number }
  embellishChance: number
  fillChance: number
  drums: { main: DrumHits; turn: DrumHits; fill: DrumHits }
}
