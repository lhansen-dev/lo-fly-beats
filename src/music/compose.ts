import type { CircuitGraph } from '../connectome/types'
import { getPreset } from '../presets/presets'
import { CHORD_QUALITIES, chooseChordSlots } from './harmony'
import { fnv1a32 } from './rng'
import { clamp } from './math'
import { compositionPhraseIndex, compositionStreams } from './streams'
import { walkPhrase } from './traversal'
import type { BassOverrides, ChordSlot, NoteEvent, PhrasePlan, PhraseScore, SessionRecipe, TraceStep } from './types'
import { MAPPING_VERSION, SCORE_VERSION } from './versions'
import { HUMANIZE_MAX_OFFSETS, HUMANIZE_VELOCITY_SPREAD, KEYS_PATTERNS, STRONG_BASS_CELLS, WEAK_BASS_CELLS, type BassCell, type BassDegree, type KeysPattern } from './patterns'

function neuronId(step: TraceStep): string | null {
  return step.kind === 'rest' ? null : step.neuronId
}

function chordForBar(chords: readonly ChordSlot[], bar: number): ChordSlot {
  return chords[Math.floor(bar / 2)]!
}

function patternFor(neuron: string): KeysPattern {
  return KEYS_PATTERNS[fnv1a32(`keys|${neuron}`) % KEYS_PATTERNS.length]!
}

function bassCellFor(neuron: string, beatInBar: number): BassCell {
  const list = beatInBar % 2 === 0 ? STRONG_BASS_CELLS : WEAK_BASS_CELLS
  return list[fnv1a32(`bass|${neuron}`) % list.length]!
}

function resolveDegree(degree: BassDegree, chord: ChordSlot, preset: ReturnType<typeof getPreset>, bar: number, beatInBar: number, chords: readonly ChordSlot[]): number {
  if (degree === 'root') return chord.rootMidi
  if (degree === 'fifth') return chord.rootMidi + 7
  if (degree === 'octave') return chord.rootMidi + 12
  const quality = preset.chordRing[chord.ringIndex]!.quality
  if (degree === 'third') return chord.rootMidi + CHORD_QUALITIES[quality].third
  if (degree === 'seventh') return chord.rootMidi + CHORD_QUALITIES[quality].seventh
  if (beatInBar === 3 && [1, 3, 5].includes(bar)) return chordForBar(chords, bar + 1).rootMidi - 1
  return chord.rootMidi + 7
}

function compareEvents(a: NoteEvent, b: NoteEvent): number {
  const layers = { drums: 0, bass: 1, keys: 2 } as const
  const drums = { kick: 0, snare: 1, hat: 2 } as const
  return a.step - b.step || layers[a.layer] - layers[b.layer]
    || (a.layer === 'drums' && b.layer === 'drums' ? drums[a.drum!] - drums[b.drum!] : 0)
    || (a.midi ?? -1) - (b.midi ?? -1)
}

function pushKeys(events: NoteEvent[], pattern: KeysPattern, bar: number, traceBeat: number, chord: ChordSlot): void {
  for (const hit of pattern.hits) {
    const notes = hit.notes === 'all' ? chord.voicing : chord.voicing.slice(-2)
    for (const midi of notes) events.push({
      layer: 'keys', step: bar * 16 + hit.step, microOffset: 0, durationSteps: hit.durationSteps,
      midi, drum: null, velocity: hit.velocity, traceBeat,
    })
  }
}

function pushDrums(events: NoteEvent[], pattern: ReturnType<typeof getPreset>['drums']['main'], bar: number): void {
  for (const drum of ['kick', 'snare', 'hat'] as const) {
    for (const [step, velocity] of pattern[drum]) events.push({
      layer: 'drums', step: bar * 16 + step, microOffset: 0, durationSteps: 1,
      midi: null, drum, velocity, traceBeat: null,
    })
  }
}

/** Shared pitch, onset, and duration rules for both legacy and experimental bass. */
export function renderBassCell(cell: BassCell, beat: number, chords: readonly ChordSlot[], preset: ReturnType<typeof getPreset>): NoteEvent[] {
  const bar = Math.floor(beat / 4)
  const beatInBar = beat % 4
  const chord = chordForBar(chords, bar)
  return cell.notes.map(note => ({
    layer: 'bass', step: bar * 16 + beatInBar * 4 + note.offset, microOffset: 0,
    durationSteps: note.durationSteps,
    midi: resolveDegree(note.degree, chord, preset, bar, beatInBar, chords), drum: null,
    velocity: note.velocity, traceBeat: beat,
  }))
}

function humanize(events: NoteEvent[], rng: ReturnType<typeof compositionStreams>['humanize']): void {
  const round4 = (value: number) => Math.round(value * 10000) / 10000
  for (const event of events) {
    const a = rng.float()
    const b = rng.float()
    const voice = event.layer === 'drums' ? event.drum! : event.layer
    event.velocity = clamp(round4(event.velocity * (1 + (a * 2 - 1) * HUMANIZE_VELOCITY_SPREAD)), 0.05, 1)
    event.microOffset = round4(b * HUMANIZE_MAX_OFFSETS[voice])
  }
}

export function buildPhrasePlan(graph: CircuitGraph, recipe: SessionRecipe, phraseIndex: number): PhrasePlan {
  const compositionIndex = compositionPhraseIndex(recipe.variation, phraseIndex)
  const streams = compositionStreams(recipe.sessionSeed, compositionIndex)
  const preset = getPreset(recipe.presetId)
  const walk = walkPhrase(graph, streams.traversal, recipe.variation)
  const chords = chooseChordSlots(graph, walk, preset)
  const trace: TraceStep[] = walk.map(step => {
    const neuron = step.kind === 'rest' ? undefined : graph.neurons.get(step.neuronId)
    return { ...step, bar: Math.floor(step.beat / 4), beatInBar: step.beat % 4, neuronType: neuron?.type ?? null, uses: [] }
  })
  const events: NoteEvent[] = []
  const selectedPatterns: (KeysPattern | undefined)[] = []
  const bassCells: (BassCell | undefined)[][] = Array.from({ length: 8 }, () => Array(4))
  const rhythmPlan: { reuse: boolean; embellish: boolean }[] = Array.from({ length: 8 }, () => ({ reuse: false, embellish: false }))

  // Consume every rhythm draw before making choices, in the authored per-bar order.
  for (let bar = 0; bar < 8; bar++) {
    if (bar >= 4) rhythmPlan[bar]!.reuse = streams.rhythm.float() < 1 - recipe.variation
    const beat3 = trace[bar * 4 + 3]!
    if (beat3.kind !== 'rest') rhythmPlan[bar]!.embellish = streams.rhythm.float() < recipe.variation * preset.embellishChance
  }
  const fill = streams.rhythm.float() < preset.fillChance * (0.5 + 0.5 * recipe.variation)
  for (let bar = 0; bar < 8; bar++) {
    const reusedFrom = rhythmPlan[bar]!.reuse ? bar - 4 : undefined
    const start = trace[bar * 4]!
    const startNeuron = neuronId(start)!
    const pattern = reusedFrom === undefined ? patternFor(startNeuron) : selectedPatterns[reusedFrom]!
    selectedPatterns[bar] = pattern
    const keyUse = `keys ${pattern.id}${reusedFrom === undefined ? '' : ` (reused from bar ${reusedFrom + 1})`}`
    start.uses.push(keyUse)
    pushKeys(events, pattern, bar, start.beat, chordForBar(chords, bar))

    for (let beatInBar = 0; beatInBar < 4; beatInBar++) {
      const current = trace[bar * 4 + beatInBar]!
      const id = neuronId(current)
      if (id === null) continue
      const priorCell = reusedFrom === undefined ? undefined : bassCells[reusedFrom]![beatInBar]
      const cell = priorCell ?? bassCellFor(id, beatInBar)
      bassCells[bar]![beatInBar] = cell
      const reuseText = priorCell ? ` (reused from bar ${reusedFrom! + 1})` : ''
      current.uses.push(`bass ${cell.id}${reuseText}`)
    }
    const slot = chords.find(item => item.traceBeat === start.beat)
    if (slot) start.uses.push(`chord ${slot.symbol}`)

    const beat3 = trace[bar * 4 + 3]!
    if (rhythmPlan[bar]!.embellish && beat3.kind !== 'rest') {
      const embellishmentChord = chordForBar(chords, bar)
      const midi = embellishmentChord.voicing[fnv1a32(`emb|${beat3.neuronId}`) % embellishmentChord.voicing.length]! + 12
      events.push({
        layer: 'keys', step: bar * 16 + 14, microOffset: 0, durationSteps: 2,
        midi, drum: null, velocity: 0.45, traceBeat: beat3.beat,
      })
      beat3.uses.push('keys embellishment')
    }
  }

  for (let bar = 0; bar < 8; bar++) {
    const pattern = bar % 4 === 3 ? preset.drums.turn : preset.drums.main
    pushDrums(events, pattern, bar)
  }
  if (fill) {
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]!
      if (event.layer === 'drums' && event.step >= 7 * 16 + 12 && event.step <= 7 * 16 + 15) events.splice(i, 1)
    }
    pushDrums(events, preset.drums.fill, 7)
  }

  return {
    recipe: { ...recipe }, phraseIndex, compositionPhraseIndex: compositionIndex,
    graphChecksum: graph.checksum, chords, trace, accompaniment: events,
    bassCells: bassCells.flatMap(bar => Array.from(bar, cell => cell?.id ?? null)), fill,
  }
}

export function renderPhrasePlan(plan: PhrasePlan, bassOverrides?: BassOverrides): PhraseScore {
  const { recipe, phraseIndex, compositionPhraseIndex: compositionIndex, fill } = plan
  const preset = getPreset(recipe.presetId)
  const chords = structuredClone(plan.chords)
  const trace = structuredClone(plan.trace)
  const events = structuredClone(plan.accompaniment)
  const cells = bassOverrides?.cells ?? plan.bassCells
  if (cells.length !== trace.length) throw new RangeError('Bass overrides must contain one action per trace beat')
  for (const step of trace) {
    if (bassOverrides) step.uses = step.uses.filter(use => !use.startsWith('bass '))
    const id = cells[step.beat]
    if (step.kind === 'rest') {
      if (id !== null && id !== 'rest') throw new RangeError(`Bass must be silent at traversal rest ${step.beat}`)
      continue
    }
    const legal = step.beatInBar % 2 === 0 ? STRONG_BASS_CELLS : WEAK_BASS_CELLS
    const cell = legal.find(cell => cell.id === id)
    if (!cell) throw new RangeError(`Illegal bass cell ${id} at beat ${step.beat}`)
    events.push(...renderBassCell(cell, step.beat, chords, preset))
  }

  // Shorten each bass note to the next onset so the line is monophonic.
  const bassEvents = events.filter(event => event.layer === 'bass').sort((a, b) => a.step - b.step)
  for (let i = 0; i < bassEvents.length - 1; i++) {
    const event = bassEvents[i]!
    const gap = bassEvents[i + 1]!.step - event.step
    event.durationSteps = Math.max(1, Math.min(event.durationSteps, gap))
  }
  events.sort(compareEvents)
  humanize(events, compositionStreams(recipe.sessionSeed, compositionIndex).humanize)

  const score: PhraseScore = {
    scoreVersion: SCORE_VERSION, mappingVersion: MAPPING_VERSION, presetId: recipe.presetId,
    presetVersion: preset.version, sessionSeed: recipe.sessionSeed, phraseIndex,
    compositionPhraseIndex: compositionIndex, variation: recipe.variation, graphChecksum: plan.graphChecksum,
    bars: 8, stepsPerBar: 16, chords, events, trace, fill,
  }
  if (bassOverrides?.provenance) score.learning = structuredClone(bassOverrides.provenance)
  return score
}

export function composePhrase(graph: CircuitGraph, recipe: SessionRecipe, phraseIndex: number): PhraseScore {
  return renderPhrasePlan(buildPhrasePlan(graph, recipe, phraseIndex))
}
