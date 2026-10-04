import { describe, expect, it, vi } from 'vitest'
import { createCueSession, startCueDriver } from './sceneCueDriver'
import type { CueSource, CueTargets, CueTimers } from './sceneCueDriver'

function setup() {
  let step: ((event: { phraseIndex: number; stepInPhrase: number; bar: number; beat: number }) => void) | undefined
  let phrase: ((event: { phraseIndex: number }) => void) | undefined
  const source: CueSource = {
    onStep: handler => { step = handler; return () => { step = undefined } },
    onPhraseStarted: handler => { phrase = handler; return () => { phrase = undefined } },
  }
  const animate = vi.fn(() => ({ cancel: vi.fn() }))
  const targets: CueTargets = { head: { animate }, eyeShine: { animate }, handsFront: { animate } }
  return { source, targets, animate, step: (event: Parameters<NonNullable<typeof step>>[0]) => step?.(event), phrase: (index: number) => phrase?.({ phraseIndex: index }) }
}

describe('scene cue driver', () => {
  it('animates cue targets and stops subscriptions, timers and animations', () => {
    vi.useFakeTimers()
    const { source, targets, animate, step, phrase } = setup()
    const stop = startCueDriver({ state: { sessionSeed: 1, rng: { float: () => 0, int: () => 0, pick: items => items[0]! }, lastRubPhrase: null, lastPhraseIndex: null }, source, targets, timers: { setTimeout, clearTimeout } })
    step({ phraseIndex: 0, stepInPhrase: 4, bar: 0, beat: 0 })
    phrase(0)
    expect(animate).toHaveBeenCalledWith(expect.any(Array), { duration: 350, easing: 'ease-out' })
    expect(vi.getTimerCount()).toBe(1)
    stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(animate.mock.results[0]?.value.cancel).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('keeps only current animation handles across many cues', () => {
    const timerState: { pending: (() => void) | null } = { pending: null }
    const timers: CueTimers = {
      setTimeout: cb => { timerState.pending = cb; return 1 },
      clearTimeout: () => { timerState.pending = null },
    }
    const { source, targets, animate, step, phrase } = setup()
    const stop = startCueDriver({ state: { sessionSeed: 1, rng: { float: () => 0, int: () => 0, pick: items => items[0]! }, lastRubPhrase: null, lastPhraseIndex: null }, source, targets, timers })
    for (let i = 0; i < 10_000; i++) step({ phraseIndex: 0, stepInPhrase: 0, bar: i, beat: i % 4 })
    for (let i = 0; i < 1_000; i++) timerState.pending?.()
    for (let i = 1; i <= 3_000; i++) phrase(i)
    expect(animate).toHaveBeenCalledTimes(12_000)
    const handles = animate.mock.results.map(result => result.value as { cancel: ReturnType<typeof vi.fn> })
    const totalCancels = () => handles.reduce((sum, handle) => sum + handle.cancel.mock.calls.length, 0)
    const before = totalCancels()
    expect(before).toBe(12_000 - 3)
    stop()
    expect(totalCancels() - before).toBe(3)
    expect(handles.every(handle => handle.cancel.mock.calls.length === 1)).toBe(true)
    expect(timerState.pending).toBeNull()
  })

  it('keeps the rub cooldown across hide and show', () => {
    const session = createCueSession({ timers: { setTimeout: () => 1, clearTimeout: () => {} } })
    const args = setup()
    const input = { sessionSeed: 9, enabled: true, hidden: false, source: args.source, targets: args.targets }
    session.update(input)
    args.phrase(3)
    expect(args.animate).toHaveBeenCalledTimes(1)
    session.update({ ...input, hidden: true })
    session.update(input)
    args.phrase(4)
    expect(args.animate).toHaveBeenCalledTimes(1)
    session.stop()
  })

  it('keeps the rub cooldown across disable and enable', () => {
    const session = createCueSession({ timers: { setTimeout: () => 1, clearTimeout: () => {} } })
    const args = setup()
    const input = { sessionSeed: 9, enabled: true, hidden: false, source: args.source, targets: args.targets }
    session.update(input)
    args.phrase(3)
    session.update({ ...input, enabled: false })
    session.update(input)
    args.phrase(4)
    expect(args.animate).toHaveBeenCalledTimes(1)
    session.stop()
  })

  it('starts fresh cue state for a new session seed', () => {
    const session = createCueSession({ timers: { setTimeout: () => 1, clearTimeout: () => {} } })
    const args = setup()
    const input = { sessionSeed: 9, enabled: true, hidden: false, source: args.source, targets: args.targets }
    session.update(input)
    const state = session.state
    session.update({ ...input, enabled: false })
    expect(session.state).toBe(state)
    session.update(input)
    expect(session.state).toBe(state)
    session.update({ ...input, sessionSeed: 10 })
    expect(session.state).not.toBe(state)
    session.stop()
    expect(session.state?.sessionSeed).toBe(10)
  })
})
