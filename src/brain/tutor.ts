import type { Rng } from '../music/rng'
import type { PresetId } from '../presets/types'
import { chordToneDegrees, encodeLeadMove, LEAD_START_DEGREE, resolveLeadDegree } from './melody'
import type { PhraseActions } from './perform'
import {
  actionIndex, BARS, HEADS, LEAD_DEGREES, LOOP_HEADS, PHRASE_STEPS, STEP_HEADS, STEPS_PER_BAR,
  type LoopHead, type StepHead,
} from './vocabulary'

/**
 * The tutor is an authored, original lofi teacher. The fly hears it during school and learns to
 * anticipate its choices; the tutor is never consulted while the fly performs.
 */
export const TUTOR_VERSION = 2

type Hits = Readonly<Record<number, 1 | 2>>
interface Groove { id: string; kick: Hits; snare: Hits; hat: Hits }

const EIGHTHS: Hits = { 0: 2, 2: 1, 4: 2, 6: 1, 8: 2, 10: 1, 12: 2, 14: 1 }
export const GROOVES: readonly Groove[] = [
  { id: 'classic', kick: { 0: 2, 10: 2 }, snare: { 4: 2, 12: 2 }, hat: EIGHTHS },
  { id: 'lazy-push', kick: { 0: 2, 7: 1, 10: 2 }, snare: { 4: 2, 12: 2, 15: 1 }, hat: { ...EIGHTHS, 15: 1 } },
  { id: 'dusty', kick: { 0: 2, 3: 1, 9: 2 }, snare: { 4: 2, 12: 2, 6: 1 }, hat: { 0: 2, 2: 1, 4: 2, 6: 1, 8: 2, 10: 1, 11: 1, 12: 2, 14: 1 } },
  { id: 'half-time', kick: { 0: 2, 11: 1 }, snare: { 8: 2 }, hat: EIGHTHS },
  { id: 'offbeat-hats', kick: { 0: 2, 8: 1 }, snare: { 4: 2, 12: 2 }, hat: { 2: 2, 6: 2, 10: 2, 14: 2 } },
  { id: 'bounce', kick: { 0: 2, 6: 1, 10: 2 }, snare: { 4: 2, 12: 2, 9: 1 }, hat: EIGHTHS },
  { id: 'rimshot', kick: { 0: 2, 10: 2, 14: 1 }, snare: { 4: 2, 12: 2 }, hat: { ...EIGHTHS, 13: 1 } },
  { id: 'stutter', kick: { 0: 2, 2: 1, 10: 2 }, snare: { 4: 2, 12: 2 }, hat: EIGHTHS },
]

/** Two-bar bass shapes over one chord. 'approach' resolves to the next chord's root. */
type Shape = Readonly<Record<number, string>>
export const BASS_SHAPES: readonly { id: string; shape: Shape }[] = [
  { id: 'follow-kick', shape: { 0: 'root', 7: 'stop', 10: 'fifth', 14: 'stop', 16: 'root', 23: 'stop', 26: 'octave', 30: 'approach' } },
  { id: 'long', shape: { 0: 'root', 24: 'fifth', 30: 'approach' } },
  { id: 'walk', shape: { 0: 'root', 6: 'stop', 8: 'fifth', 16: 'octave', 22: 'stop', 24: 'seventh', 28: 'fifth', 30: 'approach' } },
  { id: 'pulse', shape: { 0: 'root', 4: 'stop', 6: 'root', 10: 'stop', 16: 'root', 20: 'stop', 22: 'fifth', 26: 'stop', 30: 'approach' } },
  { id: 'sparse', shape: { 0: 'root', 14: 'stop', 22: 'fifth', 28: 'stop' } },
  { id: 'third-color', shape: { 0: 'root', 8: 'stop', 10: 'third', 16: 'fifth', 24: 'root', 30: 'approach' } },
]

export const KEYS_SHAPES: readonly { id: string; shape: Shape }[] = [
  { id: 'whole', shape: { 0: 'strike' } },
  { id: 'halves', shape: { 0: 'strike', 8: 'strike-top' } },
  { id: 'push', shape: { 0: 'strike', 6: 'strike-top' } },
  { id: 'stabs', shape: { 0: 'strike', 3: 'release', 6: 'strike-top', 8: 'release', 10: 'strike', 13: 'release' } },
  { id: 'late', shape: { 2: 'strike' } },
  { id: 'breathe', shape: { 0: 'strike', 12: 'release' } },
]

export const PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 1, 2, 3], [0, 4, 2, 3], [0, 5, 2, 3], [2, 3, 0, 0], [0, 1, 4, 3], [1, 2, 3, 0],
  [0, 2, 1, 3], [0, 3, 2, 1], [4, 1, 2, 3], [0, 0, 1, 1], [2, 2, 0, 0], [0, 1, 0, 1],
]

/** Two-bar lead rhythms: [onset, length] pairs within 32 steps. */
export const LEAD_RHYTHMS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 4], [6, 2], [8, 6], [18, 2], [20, 8]],
  [[2, 2], [4, 2], [6, 6], [14, 2], [16, 8]],
  [[0, 6], [8, 2], [10, 2], [12, 4], [20, 10]],
  [[3, 1], [4, 4], [10, 2], [12, 4], [16, 2], [18, 2], [20, 8]],
  [[0, 2], [2, 2], [4, 8], [16, 2], [18, 2], [20, 2], [22, 8]],
  [[6, 2], [8, 4], [14, 2], [16, 6], [24, 4]],
  [[0, 8], [16, 4], [22, 8]],
  [[4, 2], [6, 2], [8, 2], [10, 6], [24, 6]],
]

type Section = 'intro' | 'verse' | 'hook' | 'break'
const SECTION_CYCLE: readonly Section[] = ['intro', 'verse', 'hook', 'verse', 'break', 'hook']

interface Bar { [head: string]: number[] }

export interface TutorState {
  presetId: PresetId
  phrase: number
  progression: readonly number[]
  groove: number
  bassShape: number
  keysShape: number
  history: Bar[]
  leadDegree: number
}

export function createTutor(presetId: PresetId, rng: Rng): TutorState {
  return {
    presetId, phrase: 0, progression: rng.pick(PROGRESSIONS), groove: rng.int(GROOVES.length),
    bassShape: rng.int(BASS_SHAPES.length), keysShape: rng.int(KEYS_SHAPES.length), history: [], leadDegree: LEAD_START_DEGREE,
  }
}

function emptyBar(): Bar {
  return Object.fromEntries(STEP_HEADS.map(head => [head, Array<number>(STEPS_PER_BAR).fill(0)]))
}

function grooveBar(groove: Groove, rng: Rng, role: 'main' | 'turn' | 'fill', section: Section): Bar {
  const bar = emptyBar()
  const kick = { ...groove.kick } as Record<number, number>
  const snare = { ...groove.snare } as Record<number, number>
  const hat = { ...groove.hat } as Record<number, number>
  if (role === 'turn') {
    if (rng.float() < 0.5) kick[14] = 1
    else snare[15] = 1
    if (rng.float() < 0.4) delete hat[14]
  }
  if (role === 'fill') {
    for (const step of [12, 13, 14, 15]) { delete hat[step]; delete kick[step] }
    const fills = [{ 12: 1, 13: 1, 14: 2, 15: 2 }, { 12: 2, 14: 1, 15: 2 }, { 13: 1, 14: 1, 15: 1 }, { 14: 2 }]
    Object.assign(snare, rng.pick(fills))
  }
  if (section === 'intro') { for (const step of Object.keys(kick)) if (Number(step) !== 0) delete kick[Number(step)] }
  for (const [head, hits] of [['kick', kick], ['snare', snare], ['hat', hat]] as const) {
    for (const [step, level] of Object.entries(hits)) bar[head]![Number(step)] = level
  }
  return bar
}

function nearest(options: readonly number[], target: number): number {
  return options.reduce((best, option) => Math.abs(option - target) < Math.abs(best - target) ? option : best, options[0]!)
}

const TARGET = 100

/** A motif keeps its rhythm; pitches walk mostly stepwise and land on chord tones on strong beats. Onsets are TARGET + degree. */
function melody(presetId: PresetId, rhythm: readonly (readonly [number, number])[], rings: readonly [number, number], rng: Rng, start: number, cadence: number | null): number[] {
  const lead = Array<number>(32).fill(0)
  let degree = start
  rhythm.forEach(([onset, length], index) => {
    const ring = rings[onset < 16 ? 0 : 1]
    const tones = chordToneDegrees(presetId, ring)
    if (index > 0) {
      const roll = rng.float()
      const move = roll < 0.55 ? 1 : roll < 0.8 ? 2 : roll < 0.9 ? 0 : 3
      const direction = degree >= 9 ? -1 : degree <= 2 ? 1 : rng.float() < 0.5 ? -1 : 1
      degree += move * direction
    }
    if (onset % 4 === 0 || index === rhythm.length - 1) degree = nearest(tones, degree)
    if (cadence !== null && index === rhythm.length - 1) degree = nearest([cadence, cadence + 7].filter(d => d < LEAD_DEGREES), degree)
    degree = Math.max(0, Math.min(LEAD_DEGREES - 1, degree))
    lead[onset] = TARGET + degree
    const end = onset + length
    if (end < 32 && !rhythm.some(([other]) => other === end)) lead[end] = actionIndex('lead', 'rest')
  })
  return lead
}

function shapeSteps(shape: Shape, head: StepHead, length: number): number[] {
  const steps = Array<number>(length).fill(0)
  for (const [step, action] of Object.entries(shape)) steps[Number(step)] = (HEADS[head] as readonly string[]).indexOf(action)
  return steps
}

/** One tutor phrase: section-aware arrangement, consistent with its own loop decisions. */
export function tutorPhrase(tutor: TutorState, rng: Rng): PhraseActions {
  const section = SECTION_CYCLE[tutor.phrase % SECTION_CYCLE.length]!
  if (tutor.phrase > 0 && tutor.phrase % SECTION_CYCLE.length === 0 && rng.float() < 0.6) {
    tutor.progression = rng.pick(PROGRESSIONS)
    tutor.groove = rng.int(GROOVES.length)
  }
  if (rng.float() < 0.25) tutor.bassShape = rng.int(BASS_SHAPES.length)
  if (rng.float() < 0.25) tutor.keysShape = rng.int(KEYS_SHAPES.length)
  const chords = [...tutor.progression]
  const groove = GROOVES[tutor.groove]!
  const steps = Object.fromEntries(STEP_HEADS.map(head => [head, Array<number>(PHRASE_STEPS).fill(0)])) as Record<StepHead, number[]>
  const loops = Object.fromEntries(LOOP_HEADS.map(head => [head, Array<number>(BARS).fill(0)])) as Record<LoopHead, number[]>
  const bars: Bar[] = []
  const history = tutor.history

  // Drums
  // A breakdown drops the drums for the first half, then brings them back with a fill.
  const isBreak = section === 'break'
  const fillAtEnd = isBreak || rng.float() < 0.7
  const drumBars: Bar[] = []
  const look = (back: number, bar: number): Bar | undefined => bar - back >= 0 ? drumBars[bar - back] : history[history.length - (back - bar)]
  for (let bar = 0; bar < BARS; bar++) {
    let loop = 0
    const drumsPlay = !isBreak || bar >= 4
    if (drumsPlay) {
      if (bar === 1 || bar === 5) loop = rng.float() < 0.85 ? 1 : 0
      else if (bar === 2 || bar === 6) loop = 2
      else if (bar === 4) loop = !isBreak && rng.float() < 0.8 && look(4, bar) ? 3 : 0
      else if (bar === 7 && !fillAtEnd) loop = 3
      if (bar === 0 && tutor.phrase > 0 && section !== 'intro' && rng.float() < 0.5 && history.length >= 4) loop = 3
    }
    const back = [0, 1, 2, 4][loop]!
    let content: Bar
    if (loop > 0 && look(back, bar)) content = look(back, bar)!
    else {
      loop = 0
      content = drumsPlay ? grooveBar(groove, rng, bar === 7 && fillAtEnd ? 'fill' : bar === 3 ? 'turn' : 'main', section) : emptyBar()
    }
    loops.loopDrums[bar] = loop
    drumBars.push(content)
  }
  // Bass: a two-bar shape per chord, re-used over the next chord with its own roots.
  const bassShape = BASS_SHAPES[tutor.bassShape]!.shape
  const bassBars: number[][] = []
  for (let bar = 0; bar < BARS; bar++) {
    const slot = Math.floor(bar / 2)
    let loop = bar >= 2 ? 2 : 0
    if (section === 'intro' && bar < 4) loop = bar === 0 ? 0 : 1
    const back = [0, 1, 2, 4][loop]!
    let content: number[]
    if (loop > 0 && bar - back >= 0) content = bassBars[bar - back]!
    else {
      loop = 0
      const full = section === 'intro' && bar < 4 ? shapeSteps({ 0: 'root', 12: 'stop' }, 'bass', 32) : shapeSteps(bassShape, 'bass', 32)
      if (chords[slot + 1] === chords[slot] || slot === 3) {
        const approach = actionIndex('bass', 'approach')
        for (let step = 0; step < 32; step++) if (full[step] === approach) full[step] = actionIndex('bass', 'fifth')
      }
      content = full.slice((bar % 2) * 16, (bar % 2) * 16 + 16)
    }
    loops.loopBass[bar] = loop
    bassBars.push(content)
  }
  // Keys
  const keysShape = section === 'break' ? KEYS_SHAPES[0]!.shape : KEYS_SHAPES[tutor.keysShape]!.shape
  const keysBars: number[][] = []
  for (let bar = 0; bar < BARS; bar++) {
    const loop = bar === 0 ? 0 : 1
    keysBars.push(loop ? keysBars[bar - 1]! : shapeSteps(keysShape, 'keys', 16))
    loops.loopKeys[bar] = loop
  }
  // Lead: motif, answer, motif again, cadence.
  const leadBars: number[][] = Array.from({ length: BARS }, () => Array<number>(16).fill(0))
  const leadOn = section === 'verse' || section === 'hook' || section === 'break'
  const density = section === 'verse' ? 'sparse' : 'full'
  if (leadOn) {
    const rhythm = rng.pick(LEAD_RHYTHMS)
    const start = 4 + rng.int(5)
    const motif = melody(tutor.presetId, rhythm, [chords[0]!, chords[0]!], rng, start, null)
    const answer = density === 'full' ? melody(tutor.presetId, rhythm, [chords[1]!, chords[1]!], rng, Math.max(0, start - 1), null) : null
    const ending = melody(tutor.presetId, rng.pick(LEAD_RHYTHMS), [chords[3]!, chords[3]!], rng, start, 0)
    const place = (two: number[] | null, firstBar: number) => {
      if (!two) return
      leadBars[firstBar] = two.slice(0, 16)
      leadBars[firstBar + 1] = two.slice(16)
    }
    place(motif, 0)
    place(answer, 2)
    if (density === 'full') place(ending, 6)
    for (let bar = 0; bar < BARS; bar++) loops.loopLead[bar] = 0
    if (chords[2] === chords[0]) {
      leadBars[4] = leadBars[0]!; leadBars[5] = leadBars[1]!
      loops.loopLead[4] = 3; loops.loopLead[5] = 3
    } else {
      const again = melody(tutor.presetId, rhythm, [chords[2]!, chords[2]!], rng, start, null)
      place(again, 4)
    }
  }
  // Sing the targets as relative moves; looped bars repeat the moves, so they may land transposed.
  const leadStart = tutor.leadDegree
  let degree = leadStart
  const leadActions: number[][] = []
  for (let bar = 0; bar < BARS; bar++) {
    const back = [0, 1, 2, 4][loops.loopLead[bar]!]!
    const ring = chords[Math.floor(bar / 2)]!
    const moves = back ? [...leadActions[bar - back]!] : leadBars[bar]!.map(target => {
      if (target < TARGET) return target
      const encoded = encodeLeadMove(degree, target - TARGET, tutor.presetId, ring)
      degree = encoded.degree
      return encoded.action
    })
    if (back) for (const action of moves) if (action >= 2) degree = resolveLeadDegree(degree, action, tutor.presetId, ring)
    leadActions.push(moves)
  }
  tutor.leadDegree = degree
  for (let bar = 0; bar < BARS; bar++) {
    const content: Bar = { ...drumBars[bar]!, bass: bassBars[bar]!, keys: keysBars[bar]!, lead: leadActions[bar]! }
    bars.push(content)
    for (const head of STEP_HEADS) for (let step = 0; step < 16; step++) steps[head][bar * 16 + step] = content[head]![step]!
  }
  tutor.history = [...history, ...bars].slice(-8)
  tutor.phrase++
  return { leadStart, section: actionIndex('section', section === 'intro' ? 'intro' : isBreak ? 'breakdown' : 'groove'), steps, chords, loops }
}

