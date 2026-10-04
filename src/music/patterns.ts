export const HUMANIZE_VELOCITY_SPREAD = 0.06
export const HUMANIZE_MAX_OFFSETS = { kick: 0, snare: 0.04, hat: 0.06, bass: 0.03, keys: 0.08 } as const

export type BassDegree = 'root' | 'fifth' | 'octave' | 'third' | 'seventh' | 'approach'
export interface BassNotePattern {
  offset: number
  durationSteps: number
  degree: BassDegree
  velocity: number
}
export interface BassCell {
  id: string
  notes: readonly BassNotePattern[]
}

export const STRONG_BASS_CELLS: readonly BassCell[] = [
  { id: 'root-hold', notes: [{ offset: 0, durationSteps: 4, degree: 'root', velocity: 0.95 }] },
  { id: 'root-push', notes: [{ offset: 0, durationSteps: 3, degree: 'root', velocity: 0.95 }, { offset: 3, durationSteps: 1, degree: 'fifth', velocity: 0.6 }] },
  { id: 'root-octave', notes: [{ offset: 0, durationSteps: 2, degree: 'root', velocity: 0.9 }, { offset: 2, durationSteps: 2, degree: 'octave', velocity: 0.65 }] },
  { id: 'root-short', notes: [{ offset: 0, durationSteps: 2, degree: 'root', velocity: 0.9 }] },
]

export const WEAK_BASS_CELLS: readonly BassCell[] = [
  { id: 'rest', notes: [] },
  { id: 'fifth', notes: [{ offset: 0, durationSteps: 2, degree: 'fifth', velocity: 0.7 }] },
  { id: 'and-root', notes: [{ offset: 2, durationSteps: 2, degree: 'root', velocity: 0.75 }] },
  { id: 'seventh-fifth', notes: [{ offset: 0, durationSteps: 2, degree: 'seventh', velocity: 0.65 }, { offset: 2, durationSteps: 2, degree: 'fifth', velocity: 0.6 }] },
  { id: 'approach', notes: [{ offset: 2, durationSteps: 2, degree: 'approach', velocity: 0.7 }] },
]

export interface KeysHit {
  step: number
  durationSteps: number
  velocity: number
  notes: 'all' | 'top2'
}
export interface KeysPattern {
  id: 'whole' | 'halves' | 'push' | 'dotted' | 'late'
  hits: readonly KeysHit[]
}

export const KEYS_PATTERNS: readonly KeysPattern[] = [
  { id: 'whole', hits: [{ step: 0, durationSteps: 15, velocity: 0.70, notes: 'all' }] },
  { id: 'halves', hits: [{ step: 0, durationSteps: 7, velocity: 0.70, notes: 'all' }, { step: 8, durationSteps: 7, velocity: 0.60, notes: 'all' }] },
  { id: 'push', hits: [{ step: 0, durationSteps: 5, velocity: 0.72, notes: 'all' }, { step: 6, durationSteps: 9, velocity: 0.62, notes: 'all' }] },
  { id: 'dotted', hits: [{ step: 0, durationSteps: 5, velocity: 0.70, notes: 'all' }, { step: 6, durationSteps: 2, velocity: 0.55, notes: 'top2' }, { step: 10, durationSteps: 5, velocity: 0.60, notes: 'all' }] },
  { id: 'late', hits: [{ step: 2, durationSteps: 13, velocity: 0.66, notes: 'all' }] },
]
