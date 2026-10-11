import type { DrumVoice } from '../music/types'

export type PresetId = 'rainy-windowsill' | 'overripe-2am' | 'fruit-bowl-finals'
export type ChordQualityId = 'm9' | 'm7add11' | 'maj9' | 'maj7sharp11' | 'dom9' | 'dom7sus4'

export interface ChordDef {
  symbol: string
  root: number
  quality: ChordQualityId
}

export type DrumHits = Record<DrumVoice, ReadonlyArray<readonly [step: number, velocity: number]>>

export interface SoundParams {
  drumsCutoffHz: number
  keysCutoffHz: number
  bassCutoffHz: number
  masterCutoffHz: number
  reverbSend: number
  saturationWet: number
}

export interface VisualParams {
  wall: string
  windowSky: string
  glassTint: string
  desk: string
  deskEdge: string
  lightColor: string
  lightOpacity: number
  shadowOpacity: number
  uiAccent: string
}

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
  sound: SoundParams
  visual: VisualParams
}
