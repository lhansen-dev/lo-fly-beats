/**
 * What the fly can do. Step heads decide every sixteenth note; bar heads decide whether a layer
 * plays something fresh or loops an earlier bar; the chord head picks harmony every two bars.
 */
export const LEAD_DEGREES = 12

export const HEADS = Object.freeze({
  kick: ['off', 'soft', 'hard'],
  snare: ['off', 'ghost', 'hit'],
  hat: ['off', 'soft', 'accent'],
  bass: ['hold', 'stop', 'root', 'fifth', 'octave', 'third', 'seventh', 'approach'],
  keys: ['hold', 'strike', 'strike-top', 'release'],
  lead: ['hold', 'rest', 'same', 'up1', 'down1', 'up2', 'down2', 'up3', 'down3', 'up4', 'down4', 'chord'],
  chord: ['ring0', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5'],
  loopDrums: ['fresh', 'repeat1', 'repeat2', 'repeat4'],
  loopBass: ['fresh', 'repeat1', 'repeat2', 'repeat4'],
  loopKeys: ['fresh', 'repeat1', 'repeat2', 'repeat4'],
  loopLead: ['fresh', 'repeat1', 'repeat2', 'repeat4'],
} as const)

export type HeadName = keyof typeof HEADS
export const HEAD_NAMES = Object.keys(HEADS) as HeadName[]
export const STEP_HEADS = ['kick', 'snare', 'hat', 'bass', 'keys', 'lead'] as const
export type StepHead = typeof STEP_HEADS[number]
export const LOOP_HEADS = ['loopDrums', 'loopBass', 'loopKeys', 'loopLead'] as const
export type LoopHead = typeof LOOP_HEADS[number]
export const LOOP_LAYER = { loopDrums: ['kick', 'snare', 'hat'], loopBass: ['bass'], loopKeys: ['keys'], loopLead: ['lead'] } as const satisfies Record<LoopHead, readonly StepHead[]>
export const LOOP_BACK = [0, 1, 2, 4] as const

export const STEPS_PER_BAR = 16
export const BARS = 8
export const PHRASE_STEPS = STEPS_PER_BAR * BARS
export const CHORD_STEPS = 32

/**
 * Phase-tuned readout pools: like steering muscles timed by the haltere, each sixteenth of the bar
 * reads the brain through its own pool. Loop choices have one pool per bar, chords one per slot.
 */
export function headPositions(head: HeadName): number {
  return head === 'chord' ? BARS / 2 : (LOOP_HEADS as readonly string[]).includes(head) ? BARS : STEPS_PER_BAR
}

export function positionOf(head: HeadName, step: number): number {
  return head === 'chord' ? Math.floor(step / CHORD_STEPS) : (LOOP_HEADS as readonly string[]).includes(head) ? Math.floor(step / STEPS_PER_BAR) : step % STEPS_PER_BAR
}

/** First readout row of each head; a head's rows are position-major, then action. */
export const HEAD_OFFSET: Readonly<Record<HeadName, number>> = (() => {
  const offsets = {} as Record<HeadName, number>
  let offset = 0
  for (const name of HEAD_NAMES) { offsets[name] = offset; offset += HEADS[name].length * headPositions(name) }
  return Object.freeze(offsets)
})()
export const OUTPUT_SIZE = HEAD_NAMES.reduce((sum, name) => sum + HEADS[name].length * headPositions(name), 0)

export function headRow(head: HeadName, position: number, action: number): number {
  return HEAD_OFFSET[head] + position * HEADS[head].length + action
}

export function actionIndex<H extends HeadName>(head: H, action: typeof HEADS[H][number]): number {
  const index = (HEADS[head] as readonly string[]).indexOf(action)
  if (index < 0) throw new RangeError(`Unknown ${head} action ${action}`)
  return index
}
