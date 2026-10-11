import { LEAD_DEGREES } from './vocabulary'

/**
 * What reaches the fly's ear and wing-sense neurons each sixteenth note. A ticking clock (and the
 * haltere's steady oscillation) gives the pulse at several time scales; the rest is what the fly
 * heard and felt itself play on the previous sixteenth.
 */
export interface HeardSound {
  kick: number
  snare: number
  hat: number
  bassOnset: number
  /** Bass degree as a fraction of the vocabulary, or -1 when silent. */
  bassPitch: number
  keysOnset: number
  leadOnset: number
  /** Lead scale degree in [0,1], or -1 when silent. */
  leadPitch: number
  chordRing: number
}

export const SILENCE: Readonly<HeardSound> = Object.freeze({
  kick: 0, snare: 0, hat: 0, bassOnset: 0, bassPitch: -1, keysOnset: 0, leadOnset: 0, leadPitch: -1, chordRing: 0,
})

const CLOCK_PERIODS = [4, 8, 16, 32, 64, 128] as const
/** The eighth-note tick (+1 on eighths, -1 between) plus two phases for each longer period. */
export const INPUT_SIZE = 1 + CLOCK_PERIODS.length * 2 + 8 + 6 + 1

export function senseInputs(step: number, heard: Readonly<HeardSound>, out: Float32Array): Float32Array {
  if (out.length !== INPUT_SIZE) throw new RangeError('Sense buffer has the wrong size')
  let index = 0
  out[index++] = step % 2 === 0 ? 1 : -1
  for (const period of CLOCK_PERIODS) {
    const phase = 2 * Math.PI * (step % period) / period
    out[index++] = Math.cos(phase)
    out[index++] = Math.sin(phase)
  }
  out[index++] = heard.kick
  out[index++] = heard.snare
  out[index++] = heard.hat
  out[index++] = heard.bassOnset
  out[index++] = heard.bassPitch
  out[index++] = heard.keysOnset
  out[index++] = heard.leadOnset
  out[index++] = heard.leadPitch
  for (let ring = 0; ring < 6; ring++) out[index++] = heard.chordRing === ring ? 1 : 0
  out[index++] = 1
  return out
}

export function leadPitchSense(degree: number | null): number {
  return degree === null ? -1 : degree / (LEAD_DEGREES - 1)
}
