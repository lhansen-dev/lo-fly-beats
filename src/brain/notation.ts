import { getPreset } from '../presets/presets'
import type { PresetId } from '../presets/types'
import type { PhraseActions } from './perform'
import { leadDegrees } from './melody'
import { BARS, HEADS, STEPS_PER_BAR } from './vocabulary'

/** A plain-text grid of one phrase, for reading what the fly played. */
export function notate(actions: PhraseActions, presetId: PresetId, bars: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7]): string {
  const preset = getPreset(presetId)
  const lines: string[] = [`section: ${HEADS.section[actions.section]}`, `chords: ${actions.chords.map(ring => preset.chordRing[ring]!.symbol).join(' | ')}`,
    `loops d/b/k/l: ${Array.from({ length: BARS }, (_, bar) => ['loopDrums', 'loopBass', 'loopKeys', 'loopLead'].map(head => 'F124'[actions.loops[head as 'loopDrums'][bar]!]).join('')).join(' ')}`]
  const row = (label: string, render: (step: number) => string) =>
    lines.push(`${label.padEnd(5)}${bars.map(bar => Array.from({ length: STEPS_PER_BAR }, (_, step) => render(bar * STEPS_PER_BAR + step)).join('')).join('|')}`)
  row('kick', step => '.ox'[actions.steps.kick[step]!]!)
  row('snr', step => '.gX'[actions.steps.snare[step]!]!)
  row('hat', step => '.-+'[actions.steps.hat[step]!]!)
  row('bass', step => '-sR5O37a'[actions.steps.bass[step]!]!)
  row('keys', step => '-#^r'[actions.steps.keys[step]!]!)
  const degrees = leadDegrees(actions.steps.lead, actions.chords, presetId, actions.leadStart).degrees
  row('lead', step => {
    const action = actions.steps.lead[step]!
    const degree = degrees[step]
    return action === 0 ? '-' : action === 1 ? '.' : '0123456789AB'[degree!]!
  })
  return lines.join('\n')
}
