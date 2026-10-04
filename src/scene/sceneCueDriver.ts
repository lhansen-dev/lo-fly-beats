import { createCueState, nextBlinkDelayMs, phraseCue, stepCue } from './cues'
import type { CueState, CueStepEvent } from './cues'

export interface Animatable {
  animate(keyframes: Keyframe[], options: KeyframeAnimationOptions): { cancel(): void }
}

export interface CueTargets {
  head: Animatable | null
  eyeShine: Animatable | null
  handsFront: Animatable | null
}

export interface CueSource {
  onStep(h: (e: CueStepEvent) => void): () => void
  onPhraseStarted(h: (e: { phraseIndex: number }) => void): () => void
}

export interface CueTimers {
  setTimeout(cb: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

const defaultTimers: CueTimers = {
  setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export function findCueTargets(root: ParentNode): CueTargets {
  return {
    head: root.querySelector('.fly-head') as Animatable | null,
    eyeShine: root.querySelector('.fly-eye-shine') as Animatable | null,
    handsFront: root.querySelector('.fly-hands-front') as Animatable | null,
  }
}

export const BOB_KEYFRAMES: Record<'strong' | 'soft', Keyframe[]> = {
  strong: [{ transform: 'translateY(0)' }, { transform: 'translateY(8px)' }, { transform: 'translateY(0)' }],
  soft: [{ transform: 'translateY(0)' }, { transform: 'translateY(4px)' }, { transform: 'translateY(0)' }],
}
export const BLINK_KEYFRAMES: Keyframe[] = [
  { transform: 'scaleY(1)' }, { transform: 'scaleY(0.1)' }, { transform: 'scaleY(1)' },
]
export const RUB_KEYFRAMES: Keyframe[] = [
  { transform: 'translateX(0)' }, { transform: 'translateX(-3px)' },
  { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' },
]

export function startCueDriver({ state, source, targets, timers }: {
  state: CueState
  source: CueSource
  targets: CueTargets
  timers: CueTimers
}): () => void {
  let stopped = false
  let timer: unknown
  let bobAnimation: { cancel(): void } | null = null
  const animations: Array<{ cancel(): void }> = []
  const offStep = source.onStep(event => {
    const { bob } = stepCue(state, event)
    if (!bob || !targets.head) return
    bobAnimation?.cancel()
    bobAnimation = targets.head.animate(BOB_KEYFRAMES[bob], { duration: 350, easing: 'ease-out' })
    animations.push(bobAnimation)
  })
  const offPhrase = source.onPhraseStarted(({ phraseIndex }) => {
    if (phraseCue(state, phraseIndex).rub && targets.handsFront) {
      animations.push(targets.handsFront.animate(RUB_KEYFRAMES, { duration: 2400 }))
    }
  })
  const blink = (): void => {
    if (stopped) return
    if (targets.eyeShine) animations.push(targets.eyeShine.animate(BLINK_KEYFRAMES, { duration: 150 }))
    timer = timers.setTimeout(blink, nextBlinkDelayMs(state))
  }
  timer = timers.setTimeout(blink, nextBlinkDelayMs(state))
  return () => {
    if (stopped) return
    stopped = true
    offStep()
    offPhrase()
    timers.clearTimeout(timer)
    animations.forEach(animation => animation.cancel())
  }
}

export function createCueSession(options?: { timers?: CueTimers; createState?: (seed: number) => CueState }): {
  update(input: { sessionSeed: number; enabled: boolean; hidden: boolean; source: CueSource | null; targets: CueTargets | null }): void
  stop(): void
  readonly state: CueState | null
} {
  const timers = options?.timers ?? defaultTimers
  const makeState = options?.createState ?? createCueState
  let retainedState: CueState | null = null
  let stopDriver: (() => void) | null = null
  return {
    update(input) {
      stopDriver?.()
      stopDriver = null
      if (!(input.enabled && !input.hidden && input.source && input.targets)) return
      if (!retainedState || retainedState.sessionSeed !== input.sessionSeed) retainedState = makeState(input.sessionSeed)
      stopDriver = startCueDriver({ state: retainedState, source: input.source, targets: input.targets, timers })
    },
    stop() {
      stopDriver?.()
      stopDriver = null
    },
    get state() { return retainedState },
  }
}
