import { STRONG_BASS_CELLS, WEAK_BASS_CELLS, type BassCellId } from '../patterns'
import type { BassDecision, LearningPhraseInput, LearningRuntime, MusicalContext } from './types'
import { RECENT_ACTION_LIMIT } from './versions'

export const BASS_VOCABULARY: readonly BassCellId[] = Object.freeze([
  ...STRONG_BASS_CELLS.map(cell => cell.id), ...WEAK_BASS_CELLS.map(cell => cell.id),
])
export const INPUT_SIZE = 4 + 2 + 6 + 9 + 1

export function legalBassActions(beatInBar: number, forcedRest: boolean): boolean[] {
  const legal = beatInBar % 2 === 0 ? STRONG_BASS_CELLS : WEAK_BASS_CELLS
  return BASS_VOCABULARY.map(id => !forcedRest && legal.some(cell => cell.id === id))
}

export function musicalContext(plan: LearningPhraseInput, beat: number, runtime: LearningRuntime): MusicalContext {
  const step = plan.trace[beat]
  if (!step) throw new RangeError(`No musical context at beat ${beat}`)
  const chord = plan.chords[Math.floor(step.bar / 2)]!
  const barParity = step.bar % 2
  const inputs = Array<number>(INPUT_SIZE).fill(0)
  inputs[step.beatInBar] = 1
  inputs[4 + barParity] = 1
  inputs[6 + chord.ringIndex] = 1
  if (runtime.previousBassAction !== null) inputs[12 + BASS_VOCABULARY.indexOf(runtime.previousBassAction)] = 1
  inputs[21] = step.kind === 'rest' ? 1 : 0
  return {
    beat, beatInBar: step.beatInBar, barParity, chordRingIndex: chord.ringIndex,
    previousBassAction: runtime.previousBassAction, traversalRest: step.kind === 'rest', inputs,
  }
}

export function advanceContext(runtime: LearningRuntime, decision: BassDecision, limit = RECENT_ACTION_LIMIT): LearningRuntime {
  return {
    ...runtime,
    previousBassAction: decision.cellId,
    contextBeatIndex: runtime.contextBeatIndex + 1,
    recentActions: [...runtime.recentActions, {
      contextBeatIndex: runtime.contextBeatIndex, cellId: decision.cellId, forcedRest: decision.forcedRest,
    }].slice(-limit),
  }
}
