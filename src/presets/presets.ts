import type { PresetId, PresetDefinition } from './types'

export const DEFAULT_PRESET_ID: PresetId = 'rainy-windowsill'

type PresetWithoutVisual = Omit<PresetDefinition, 'visual'>

export const PRESETS: Record<PresetId, PresetWithoutVisual> = {
  'rainy-windowsill': {
    id: 'rainy-windowsill', version: 1, name: 'Rainy Windowsill', keyName: 'D minor', tempoBpm: 72, swing: 0.56,
    chordRing: [
      { symbol: 'Dm9', root: 2, quality: 'm9' }, { symbol: 'Bbmaj9', root: 10, quality: 'maj9' },
      { symbol: 'Gm9', root: 7, quality: 'm9' }, { symbol: 'C9', root: 0, quality: 'dom9' },
      { symbol: 'Fmaj9', root: 5, quality: 'maj9' }, { symbol: 'Am7(11)', root: 9, quality: 'm7add11' },
    ],
    keysRange: { low: 50, center: 62, high: 76 }, embellishChance: 0.35, fillChance: 0.25,
    sound: { keysCutoffHz: 2200, bassCutoffHz: 140, masterCutoffHz: 12000, reverbSend: 0.25, saturationWet: 0, rainLevel: 0.5, crackleLevel: 0.25 },
    drums: {
      main: { kick: [[0, 0.9], [10, 0.75]], snare: [[4, 0.8], [12, 0.8]], hat: [[0, 0.5], [2, 0.3], [4, 0.45], [6, 0.3], [8, 0.5], [10, 0.3], [12, 0.45], [14, 0.35], [15, 0.18]] },
      turn: { kick: [[0, 0.9], [7, 0.55], [10, 0.75]], snare: [[4, 0.8], [12, 0.8], [15, 0.25]], hat: [[0, 0.5], [2, 0.3], [4, 0.45], [6, 0.3], [8, 0.5], [10, 0.3], [12, 0.45], [14, 0.35]] },
      fill: { kick: [[12, 0.6]], snare: [[12, 0.55], [13, 0.35], [14, 0.6], [15, 0.7]], hat: [[12, 0.3]] },
    },
  },
  'overripe-2am': {
    id: 'overripe-2am', version: 1, name: 'Overripe at 2 AM', keyName: 'C minor', tempoBpm: 64, swing: 0.6,
    chordRing: [
      { symbol: 'Cm9', root: 0, quality: 'm9' }, { symbol: 'Abmaj7#11', root: 8, quality: 'maj7sharp11' },
      { symbol: 'Fm9', root: 5, quality: 'm9' }, { symbol: 'Bb7sus4', root: 10, quality: 'dom7sus4' },
      { symbol: 'Ebmaj9', root: 3, quality: 'maj9' }, { symbol: 'Gm7(11)', root: 7, quality: 'm7add11' },
    ],
    keysRange: { low: 48, center: 59, high: 72 }, embellishChance: 0.2, fillChance: 0.1,
    sound: { keysCutoffHz: 1400, bassCutoffHz: 110, masterCutoffHz: 9000, reverbSend: 0.3, saturationWet: 0.35, rainLevel: 0.3, crackleLevel: 0.35 },
    drums: {
      main: { kick: [[0, 0.85], [11, 0.55]], snare: [[4, 0.7], [12, 0.7]], hat: [[0, 0.35], [4, 0.3], [8, 0.35], [12, 0.3], [14, 0.2]] },
      turn: { kick: [[0, 0.85], [11, 0.55]], snare: [[4, 0.7], [12, 0.7]], hat: [[0, 0.35], [4, 0.3], [8, 0.35], [10, 0.18], [12, 0.3]] },
      fill: { kick: [], snare: [[12, 0.5], [14, 0.45], [15, 0.3]], hat: [] },
    },
  },
  'fruit-bowl-finals': {
    id: 'fruit-bowl-finals', version: 1, name: 'Fruit Bowl Finals', keyName: 'A Dorian', tempoBpm: 86, swing: 0.55,
    chordRing: [
      { symbol: 'Am9', root: 9, quality: 'm9' }, { symbol: 'Cmaj9', root: 0, quality: 'maj9' },
      { symbol: 'D9', root: 2, quality: 'dom9' }, { symbol: 'Gmaj9', root: 7, quality: 'maj9' },
      { symbol: 'Em9', root: 4, quality: 'm9' }, { symbol: 'Bm7(11)', root: 11, quality: 'm7add11' },
    ],
    keysRange: { low: 52, center: 65, high: 79 }, embellishChance: 0.5, fillChance: 0.5,
    sound: { keysCutoffHz: 3400, bassCutoffHz: 180, masterCutoffHz: 14000, reverbSend: 0.18, saturationWet: 0, rainLevel: 0.2, crackleLevel: 0.2 },
    drums: {
      main: { kick: [[0, 0.95], [6, 0.6], [10, 0.8]], snare: [[4, 0.85], [12, 0.85], [15, 0.22]], hat: [[0, 0.55], [2, 0.35], [3, 0.2], [4, 0.5], [6, 0.35], [8, 0.55], [10, 0.35], [11, 0.2], [12, 0.5], [14, 0.4]] },
      turn: { kick: [[0, 0.95], [6, 0.6], [9, 0.5], [10, 0.8]], snare: [[4, 0.85], [12, 0.85], [14, 0.3], [15, 0.4]], hat: [[0, 0.55], [2, 0.35], [3, 0.2], [4, 0.5], [6, 0.35], [8, 0.55], [10, 0.35], [11, 0.2], [12, 0.5], [14, 0.4]] },
      fill: { kick: [[12, 0.7]], snare: [[12, 0.6], [13, 0.45], [14, 0.65], [15, 0.8]], hat: [[14, 0.3]] },
    },
  },
}

export function getPreset(id: PresetId): PresetWithoutVisual {
  return PRESETS[id]
}
