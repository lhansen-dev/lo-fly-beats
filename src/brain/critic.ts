import type { PresetId } from '../presets/types'
import { isChordTone as chordToneAt, leadDegrees } from './melody'
import type { PhraseActions } from './perform'
import { BARS, CHORD_STEPS, HEADS, LEAD_DEGREES, PHRASE_STEPS, STEPS_PER_BAR } from './vocabulary'

const sectionOf = (actions: PhraseActions) => HEADS.section[actions.section] ?? 'groove'

/** A section only counts when the music does what its name says. */
export function realizesSection(actions: PhraseActions): boolean {
  const section = sectionOf(actions)
  const bars = Array.from({ length: BARS }, (_, index) => ({
    kicks: actions.steps.kick.slice(index * STEPS_PER_BAR, (index + 1) * STEPS_PER_BAR).filter(Boolean).length,
    snares: actions.steps.snare.slice(index * STEPS_PER_BAR, (index + 1) * STEPS_PER_BAR).filter(value => value === 2).length,
  }))
  if (section === 'breakdown') return bars.filter(bar => bar.kicks === 0 && bar.snares === 0).length >= 2
  if (section === 'intro') return bars.slice(0, 4).reduce((sum, bar) => sum + bar.kicks, 0) <= 5
  return true
}

/**
 * The banana critic: authored musical proxies scored in [0, 1]. They reward lofi idioms
 * (a steady backbeat, rooted bass, sparse singable melodies, loops with small changes) and are
 * no substitute for listening. Layers are scored bar by bar so practice can credit each choice
 * to the bar it shaped, plus phrase-level qualities such as motifs, form, and novelty.
 */
export const CRITIC_VERSION = 6
export const CRITIC_PARTS = ['drums', 'bass', 'harmony', 'keys', 'lead', 'structure'] as const
export type CriticPart = typeof CRITIC_PARTS[number]
export const BAR_PARTS = ['drums', 'bass', 'keys', 'lead'] as const
export type BarPart = typeof BAR_PARTS[number]
export type Critique = Record<CriticPart, number> & {
  total: number
  /** Per-bar local scores for the layers that play in bars. */
  bars: Record<BarPart, number[]>
  notes: string[]
}

const WEIGHTS: Record<CriticPart, number> = { drums: 0.24, bass: 0.18, harmony: 0.12, keys: 0.1, lead: 0.24, structure: 0.12 }

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const mean = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
/** Weighted mean of [score, weight] pairs. */
const blend = (terms: readonly (readonly [number, number])[]) => {
  const total = terms.reduce((sum, [, weight]) => sum + weight, 0)
  return terms.reduce((sum, [score, weight]) => sum + clamp01(score) * weight, 0) / total
}
/** 1 inside [low, high], falling linearly to 0 over `soft` beyond either edge. */
export const band = (value: number, low: number, high: number, soft: number) =>
  value < low ? clamp01(1 - (low - value) / soft) : value > high ? clamp01(1 - (value - high) / soft) : 1

function bar(steps: readonly number[], index: number): number[] {
  return steps.slice(index * STEPS_PER_BAR, (index + 1) * STEPS_PER_BAR)
}

function jaccard(a: readonly number[], b: readonly number[]): number {
  let both = 0
  let either = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]! > 0
    const y = b[i]! > 0
    if (x && y && a[i] === b[i]) both++
    if (x || y) either++
  }
  return either === 0 ? 1 : both / either
}

interface PartResult { score: number; bars?: number[]; notes: string[] }

function drums(actions: PhraseActions): PartResult {
  const { kick, snare, hat } = actions.steps
  const notes: string[] = []
  const bars: number[] = []
  let playing = 0
  for (let index = 0; index < BARS; index++) {
    const k = bar(kick, index)
    const s = bar(snare, index)
    const h = bar(hat, index)
    const total = k.filter(Boolean).length + s.filter(Boolean).length + h.filter(Boolean).length
    const section = sectionOf(actions)
    // A breakdown may rest the drums; an intro may keep them light. A groove should keep playing.
    if (total === 0) { bars.push(section === 'breakdown' ? 0.95 : section === 'intro' ? 0.8 : 0.5); continue }
    playing++
    const isTurn = index === BARS - 1 || index === 3
    const halfTime = s[8] === 2 && s[4] !== 2 && s[12] !== 2
    const backbeat = (s[4] === 2 && s[12] === 2) || halfTime ? 1 : s[4] === 2 || s[12] === 2 ? 0.35 : 0
    const kicks = k.filter(Boolean).length
    const strayHits = s.filter((value, step) => value === 2 && step !== 4 && step !== 12 && !(halfTime && step === 8) && !(isTurn && step >= 12)).length
    const hats = h.filter(Boolean).length
    const evenHats = h.filter((value, step) => value && step % 2 === 0).length
    let clashes = 0
    for (let step = 0; step < 16; step++) if (k[step] && s[step] === 2) clashes++
    // Hat accents should follow one feel: on the beats, or on the off-beat eighths, not a mix.
    const accents = h.flatMap((value, step) => value === 2 ? [step] : [])
    const onBeat = accents.filter(step => step % 4 === 0).length
    const offBeat = accents.filter(step => step % 4 === 2).length
    const accentFeel = accents.length ? Math.max(onBeat, offBeat) / accents.length : 1
    // The downbeat kick and the backbeat are the groove; everything else only decorates it.
    const lightIntro = sectionOf(actions) === 'intro'
    const core = (k[0] === 2 ? 1 : k[0] === 1 ? 0.6 : lightIntro ? 0.7 : 0.1) * Math.max(0.1, backbeat) * 0.7 ** strayHits * (clashes ? 0.5 : 1)
    bars.push(core * blend([
      [k.slice(6, 16).some(value => value > 0) || lightIntro ? 1 : 0.3, 1],
      [lightIntro ? band(kicks, 0, 2, 2) : band(kicks, 2, 3, 2), 1],
      [band(s.filter(value => value === 1).length, 0, 2, 2), 0.5],
      [band(hats, 4, 10, 4), 1],
      [hats ? evenHats / hats : 0.6, 1],
      [band(evenHats / 8, 0.5, 1, 0.4), 1],
      [accentFeel, 1],
      [band(k.filter((value, step) => value && step % 2 === 1).length, 0, 1, 2), 0.5],
    ]))
  }
  const section = sectionOf(actions)
  if (playing < 6 && section === 'groove') notes.push('drums dropped out for a while')
  // Loops: bars 2-3 and 6-7 should mostly echo the bar that opened their half.
  const pattern = (index: number) => [...bar(kick, index), ...bar(snare, index), ...bar(hat, index)]
  const loopiness = mean([1, 2, 5, 6].map(index => jaccard(pattern(index), pattern(index < 4 ? 0 : 4))))
  const turnaround = jaccard(pattern(7), pattern(6)) < 0.95 || jaccard(pattern(3), pattern(2)) < 0.95 ? 1 : 0.5
  const presence = section === 'breakdown' ? band(playing, 2, 5, 2) : section === 'intro' ? band(playing, 3, 8, 3) : band(playing, 6, 8, 4)
  return { score: blend([[mean(bars), 6], [presence, 1], [band(loopiness, 0.6, 1, 0.4), 1.5], [turnaround, 0.5]]), bars, notes }
}

function bass(actions: PhraseActions): PartResult {
  const steps = actions.steps.bass
  const kick = actions.steps.kick
  const name = (step: number) => HEADS.bass[steps[step]!]!
  const onsets = steps.flatMap((action, step) => action >= 2 ? [step] : [])
  const notes: string[] = []
  let sounding = false
  const idleStops = Array<number>(BARS).fill(0)
  for (let step = 0; step < PHRASE_STEPS; step++) {
    const action = steps[step]!
    if (action >= 2) sounding = true
    else if (action === 1) { if (!sounding) idleStops[Math.floor(step / 16)]!++; sounding = false }
  }
  const bars = Array.from({ length: BARS }, (_, index) => {
    const own = onsets.filter(step => Math.floor(step / 16) === index)
    const first = index * 16
    const slotStart = index % 2 === 0
    const terms: [number, number][] = [
      [band(own.length, 1, 3, 2), 1],
      [own.length ? own.filter(step => kick[step]! > 0).length / own.length / 0.5 : 0.5, 1],
      [own.filter(step => step % 8 === 0 && ['third', 'seventh', 'approach'].includes(name(step))).length ? 0.2 : 1, 1],
      [band(idleStops[index]!, 0, 1, 3), 0.5],
      [own.every(step => name(step) !== 'approach' || (step % 32 >= 28 && actions.chords[(Math.floor(step / 32) + 1) % 4] !== actions.chords[Math.floor(step / 32)])) ? 1 : 0.2, 1],
    ]
    if (slotStart) terms.push([name(first) === 'root' ? 1 : name(first) === 'octave' ? 0.6 : 0, 2.5])
    return blend(terms)
  })
  if (mean([0, 2, 4, 6].map(index => name(index * 16) === 'root' ? 1 : 0)) < 0.5) notes.push('bass missed the chord roots')
  const twoBarMovement = Array.from({ length: BARS / 2 }, (_, slot) => onsets.filter(step => Math.floor(step / 32) === slot).length)
  // A bassline that only ever holds the root is safe but asleep.
  const colors = new Set(onsets.map(name)).size
  return { score: blend([[mean(bars), 5], [mean(twoBarMovement.map(count => band(count, 3, 7, 2))), 1], [band(colors, 2, 4, 1), 0.75]]), bars, notes }
}

function harmony(actions: PhraseActions, previous: readonly PhraseActions[], repertoire: readonly string[]): PartResult {
  const chords = actions.chords
  const distinct = new Set(chords).size
  const tonic = chords[0] === 0 || chords[2] === 0 ? 1 : chords.includes(0) ? 0.6 : 0.2
  let movement = 0
  for (let index = 0; index < 4; index++) movement += chords[index] === chords[(index + 1) % 4] ? 0.5 : 1
  const lastProgression = previous.at(-1)?.chords
  const continuity = lastProgression ? (lastProgression.join() === chords.join() ? 1 : 0.6) : 0.8
  const terms = [band(distinct, 2, 4, 1.5), tonic, movement / 4, continuity]
  // When starting a new song, a progression the fly has leaned on lately is less exciting.
  if (previous.length === 0 && repertoire.length >= 5) {
    const share = repertoire.filter(progression => progression === chords.join()).length / repertoire.length
    terms.push(band(share, 0, 0.2, 0.4))
  }
  return { score: mean(terms), notes: distinct === 1 ? ['one chord all phrase'] : [] }
}

function keys(actions: PhraseActions): PartResult {
  const steps = actions.steps.keys
  const strikes = steps.flatMap((action, step) => action === 1 || action === 2 ? [step] : [])
  // How long each strike rings, and releases that silence nothing.
  const lengths = new Map<number, number>()
  const idle = Array<number>(BARS).fill(0)
  let ringing: number | null = null
  const end = (step: number) => { if (ringing !== null) lengths.set(ringing, step - ringing); ringing = null }
  for (let step = 0; step < PHRASE_STEPS; step++) {
    if (step > 0 && step % CHORD_STEPS === 0) end(step)
    const action = steps[step]!
    if (action === 3) {
      if (ringing === null) idle[Math.floor(step / 16)]!++
      end(step)
    } else if (action === 1 || action === 2) {
      end(step)
      ringing = step
    }
  }
  end(PHRASE_STEPS)
  const bars = Array.from({ length: BARS }, (_, index) => {
    const own = strikes.filter(step => Math.floor(step / 16) === index)
    // Striking the same chord again a sixteenth or two later is a stutter, not comping.
    const restrikes = own.filter(step => strikes.some(other => other < step && step - other < 3)).length
    const ring = own.length ? mean(own.map(step => band(lengths.get(step) ?? 0, 4, 32, 3))) : 0.5
    const terms: [number, number][] = [[band(own.length, 1, 3, 2), 1], [restrikes ? 0 : 1, 1.5], [band(idle[index]!, 0, 0, 3), 0.5], [ring, 1.5]]
    if (index % 2 === 0) terms.push([steps[index * 16] === 1 ? 1 : steps[index * 16] === 2 ? 0.6 : 0, 2])
    return blend(terms)
  })
  return { score: mean(bars), bars, notes: bars.some(score => score < 0.5) ? ['keys stuttered'] : [] }
}

function lead(actions: PhraseActions, presetId: PresetId): PartResult {
  const steps = actions.steps.lead
  const resolved = leadDegrees(steps, actions.chords, presetId, actions.leadStart).degrees
  const onsets = resolved.flatMap((degree, step) => degree !== null ? [step] : [])
  if (onsets.length === 0) {
    const section = sectionOf(actions)
    const score = section === 'intro' ? 0.85 : section === 'breakdown' ? 0.25 : 0.45
    return { score, bars: Array<number>(BARS).fill(score), notes: section === 'intro' ? [] : ['no melody this time'] }
  }
  const degree = (step: number) => resolved[step]!
  const isChordTone = (step: number) => chordToneAt(presetId, actions.chords[Math.floor(step / CHORD_STEPS)]!, degree(step))
  const notes: string[] = []
  const bars = Array.from({ length: BARS }, (_, index) => {
    const own = onsets.filter(step => Math.floor(step / 16) === index)
    if (own.length === 0) return 0.7
    const strong = own.filter(step => step % 4 === 0)
    const moves = own.map(step => {
      const previous = onsets[onsets.indexOf(step) - 1]
      return previous === undefined ? null : { gap: step - previous, interval: Math.abs(degree(step) - degree(previous)) }
    }).filter(move => move !== null)
    // Lofi melodies breathe: crowded bars and sixteenth-note runs scale the whole bar down.
    const runs = moves.filter(move => move.gap === 1).length
    const crowding = (own.length > 6 ? 0.5 : 1) * 0.8 ** runs
    return crowding * blend([
      [strong.length ? strong.filter(isChordTone).length / strong.length : 0.8, 2],
      [own.filter(isChordTone).length / own.length / 0.6, 1],
      [moves.length ? moves.filter(move => move.interval <= 2).length / moves.length : 1, 1],
      [moves.length ? 1 - moves.filter(move => move.interval > 4).length / moves.length : 1, 1],
      [moves.length ? band(moves.filter(move => move.gap === 1).length / moves.length, 0, 0.15, 0.3) : 1, 1.5],
      [moves.length ? band(moves.filter(move => move.interval === 0).length / moves.length, 0, 0.3, 0.4) : 1, 0.75],
      [band(own.length, 1, 5, 3), 1],
    ])
  })
  const rhythm = (first: number) => Array.from({ length: 32 }, (_, offset) => resolved[first * 16 + offset] !== null ? 1 : 0)
  const degrees = onsets.map(degree)
  const range = Math.max(...degrees) - Math.min(...degrees)
  const breathing = bars.filter((_, index) => onsets.filter(step => Math.floor(step / 16) === index).length <= 2).length
  const last = onsets.at(-1)!
  const phrase = blend([
    [band(onsets.length, 8, 22, 10), 1.5], [band(jaccard(rhythm(0), rhythm(4)), 0.5, 1, 0.5), 1],
    [band(jaccard(rhythm(0), rhythm(2)), 0.3, 0.9, 0.4), 0.75], [isChordTone(last) ? 1 : 0.4, 0.75],
    [band(range, 3, Math.min(9, LEAD_DEGREES - 1), 3), 0.75], [band(breathing, 2, 6, 2), 1],
  ])
  if (mean(bars) < 0.6) notes.push('melody leaned on clashing notes or ran too fast')
  if (onsets.length > 30) notes.push('melody was very busy')
  return { score: blend([[mean(bars), 1], [phrase, 1]]), bars, notes }
}

function similarity(a: PhraseActions, b: PhraseActions): number {
  const layers = ['kick', 'snare', 'hat', 'bass', 'keys', 'lead'] as const
  return mean(layers.map(layer => jaccard(a.steps[layer], b.steps[layer])))
}

function structure(actions: PhraseActions, previous: readonly PhraseActions[]): PartResult {
  const notes: string[] = []
  const onsetsPerBar = Array.from({ length: BARS }, (_, index) =>
    (['kick', 'snare', 'hat', 'bass', 'lead'] as const).reduce((sum, layer) => sum + bar(actions.steps[layer], index).filter(value => value >= (layer === 'bass' || layer === 'lead' ? 2 : 1)).length, 0))
  const busy = mean(onsetsPerBar.map(count => band(count, 8, 24, 10)))
  const recent = previous.slice(-4)
  let novelty = 0.35
  if (recent.length) novelty = 1 - Math.max(...recent.map(earlier => similarity(actions, earlier)))
  if (novelty < 0.08) notes.push('played the exact same thing again')
  // Song form: intros open songs, breakdowns come after a few grooves and never twice running.
  const section = sectionOf(actions)
  const before = previous.map(sectionOf)
  let form = 1
  if (section === 'intro') form = before.length === 0 ? 1 : 0.25
  else if (section === 'breakdown') form = before.length < 2 ? 0.35 : before.at(-1) === 'breakdown' || before.at(-2) === 'breakdown' ? 0.2 : 1
  else if (before.length >= 3 && before.slice(-3).every(earlier => earlier === 'groove')) form = 0.45
  if (!realizesSection(actions)) {
    form = 0.15
    notes.push(`called it ${section === 'intro' ? 'an intro' : 'a breakdown'} but kept the drums going`)
  } else if (form < 0.5) notes.push(`a ${section} felt out of place`)
  if (form < 0.5 && section === 'groove') notes.push('the song needed a change of section')
  return { score: mean([busy, band(novelty, 0.15, 0.6, 0.25), form, form]), notes }
}

/** `repertoire` lists progressions the fly recently opened songs with, most recent last. */
export function critique(actions: PhraseActions, presetId: PresetId, previous: readonly PhraseActions[] = [], repertoire: readonly string[] = []): Critique {
  if (actions.chords.length !== 4 || actions.steps.kick.length !== PHRASE_STEPS) throw new Error('Critic needs a complete phrase')
  const parts = {
    drums: drums(actions), bass: bass(actions), harmony: harmony(actions, previous, repertoire),
    keys: keys(actions), lead: lead(actions, presetId), structure: structure(actions, previous),
  }
  const result = Object.fromEntries(CRITIC_PARTS.map(part => [part, clamp01(parts[part].score)])) as Record<CriticPart, number>
  const total = CRITIC_PARTS.reduce((sum, part) => sum + WEIGHTS[part] * result[part], 0)
  const bars = Object.fromEntries(BAR_PARTS.map(part => [part, parts[part].bars!])) as Record<BarPart, number[]>
  return { ...result, total, bars, notes: CRITIC_PARTS.flatMap(part => parts[part].notes) }
}

/** Bananas are the critic's total on a friendly 0-10 scale. */
export function bananas(critic: Critique): number {
  return Math.round(critic.total * 100) / 10
}
