import type { NoteEvent } from '../music/types'

export const PHRASE_STEPS = 128
export const EXPORT_TAIL_SECONDS = 2
export const EXPORT_FADE_SECONDS = 0.5

export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
export const secondsPerStep = (bpm: number) => 60 / bpm / 4
export const swingOffsetSteps = (step: number, swing: number) => (step % 2 === 1 ? 2 * swing - 1 : 0)
export const eventOffsetSeconds = (event: NoteEvent, bpm: number, swing: number) =>
  (swingOffsetSteps(event.step, swing) + event.microOffset) * secondsPerStep(bpm)
export const eventTimeSeconds = (event: NoteEvent, bpm: number, swing: number) =>
  event.step * secondsPerStep(bpm) + eventOffsetSeconds(event, bpm, swing)
export const eventDurationSeconds = (event: NoteEvent, bpm: number) => event.durationSteps * secondsPerStep(bpm)
export const phraseSeconds = (bpm: number) => PHRASE_STEPS * secondsPerStep(bpm)
export const exportSeconds = (bpm: number) => phraseSeconds(bpm) + EXPORT_TAIL_SECONDS
