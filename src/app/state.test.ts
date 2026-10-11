import { describe, expect, it } from 'vitest'
import { appReducer, createInitialState, type AppAction, type RestoredSettings } from './state'
import type { PhraseScore } from '../music/types'
import { DEFAULT_MIX } from '../audio/rig'
import { DEFAULT_PRESET_ID } from '../presets/presets'

const initial = () => createInitialState(null)

describe('app state', () => {
  it('creates the initial state', () => {
    expect(initial()).toEqual({
      circuit: { status: 'loading', manifest: null, error: null }, engineStatus: 'idle', audioNotice: null, learning: null, brain: null,
      active: { recipeVersion: 1, presetId: DEFAULT_PRESET_ID, sessionSeed: 1, variation: 0, tempoBpm: 72 },
      pending: {}, position: { phraseIndex: 0, bar: 0, beat: 0 }, mix: DEFAULT_MIX, activeScore: null, tapePhrases: 0, radio: true,
      exportState: { status: 'idle', fileName: null, url: null, message: null },
      ui: { animationEnabled: null, storageAvailable: true },
    })
  })

  it('uses restored settings', () => {
    const restored: RestoredSettings = {
      mappingVersion: 1, presetVersion: 1, presetId: 'overripe-2am', sessionSeed: 42,
      tempoBpm: 88, variation: 0.7, mix: { ...DEFAULT_MIX, masterVolume: 0.4 }, animationEnabled: false,
    }
    const state = createInitialState(restored)
    expect(state.active).toEqual({ recipeVersion: 1, presetId: 'overripe-2am', sessionSeed: 42, tempoBpm: 88, variation: 0.7 })
    expect(state.mix).toBe(restored.mix)
    expect(state.ui.animationEnabled).toBe(false)
    expect(state.position).toEqual({ phraseIndex: 0, bar: 0, beat: 0 })
    expect(state.ui.storageAvailable).toBe(true)
  })

  it('handles every implemented action', () => {
    const state = initial()
    const manifest = {} as never
    const score = { scoreVersion: 1, phraseIndex: 4 } as unknown as PhraseScore
    const mix = { ...DEFAULT_MIX, masterVolume: 0.2 }
    const position = { phraseIndex: 3, bar: 2, beat: 1 }
    const cases: Array<[AppAction, (next: ReturnType<typeof initial>) => void]> = [
      [{ type: 'circuitLoading' }, next => expect(next.circuit).toEqual({ status: 'loading', manifest: null, error: null })],
      [{ type: 'circuitLoaded', manifest }, next => expect(next.circuit).toEqual({ status: 'ready', manifest, error: null })],
      [{ type: 'circuitFailed', code: 'network', message: 'failed' }, next => expect(next.circuit).toEqual({ status: 'error', manifest: null, error: { code: 'network', message: 'failed' } })],
      [{ type: 'engineStatusChanged', status: 'playing' }, next => expect(next.engineStatus).toBe('playing')],
      [{ type: 'audioNoticeChanged', notice: 'notice' }, next => expect(next.audioNotice).toBe('notice')],
      [{ type: 'phraseStarted', score }, next => { expect(next.activeScore).toBe(score); expect(next.position).toEqual({ phraseIndex: 4, bar: 0, beat: 0 }) }],
      [{ type: 'positionChanged', position }, next => expect(next.position).toBe(position)],
      [{ type: 'mixChanged', mix }, next => expect(next.mix).toBe(mix)],
      [{ type: 'exportStateChanged', exportState: { status: 'ready', fileName: 'beat.wav' } }, next => expect(next.exportState).toEqual({ status: 'ready', fileName: 'beat.wav', url: null, message: null })],
      [{ type: 'animationToggled', enabled: false }, next => expect(next.ui).toEqual({ animationEnabled: false, storageAvailable: true })],
      [{ type: 'storageUnavailable' }, next => expect(next.ui.storageAvailable).toBe(false)],
    ]
    for (const [action, assert] of cases) assert(appReducer(state, action))
  })

  it('does not mutate the original state', () => {
    const state = initial()
    const snapshot = structuredClone(state)
    const result = appReducer(state, { type: 'storageUnavailable' })
    expect(state).toEqual(snapshot)
    expect(result).not.toBe(state)
  })
})

describe('control requests', () => {
  const scored = () => appReducer(initial(), { type: 'phraseStarted', score: { scoreVersion: 1, phraseIndex: 4 } as unknown as PhraseScore })

  it('applies immediate and pending tempo requests', () => {
    const state = appReducer(appReducer(initial(), { type: 'positionChanged', position: { phraseIndex: 2, bar: 1, beat: 3 } }), { type: 'tempoRequested', tempoBpm: 90, immediate: false })
    expect(state.pending.tempoBpm).toBe(90)
    const applied = appReducer(state, { type: 'tempoRequested', tempoBpm: 100, immediate: true })
    expect(applied.active.tempoBpm).toBe(100)
    expect(applied.pending).toEqual({})
    expect(applied.position).toEqual(state.position)
  })

  it('applies immediate and pending variation requests', () => {
    expect(appReducer(initial(), { type: 'variationRequested', variation: 0.4, immediate: false }).pending.variation).toBe(0.4)
    expect(appReducer(initial(), { type: 'variationRequested', variation: 0.8, immediate: true }).active.variation).toBe(0.8)
  })

  it('resets score and position for an immediate new beat', () => {
    const state = appReducer(scored(), { type: 'newBeatRequested', sessionSeed: 2, immediate: false })
    const next = appReducer(state, { type: 'newBeatRequested', sessionSeed: 3, immediate: true })
    expect(next.active.sessionSeed).toBe(3)
    expect(next.position).toEqual({ phraseIndex: 0, bar: 0, beat: 0 })
    expect(next.activeScore).toBeNull()
    expect(next.pending).toEqual({})
  })

  it('keeps a pending new beat from changing position or score', () => {
    const state = scored()
    const next = appReducer(state, { type: 'newBeatRequested', sessionSeed: 5, immediate: false })
    expect(next.pending.sessionSeed).toBe(5)
    expect(next.position).toBe(state.position)
    expect(next.activeScore).toBe(state.activeScore)
  })

  it('applies immediate and pending preset requests', () => {
    const pending = appReducer(initial(), { type: 'presetRequested', presetId: 'overripe-2am', tempoBpm: 88, immediate: false })
    expect(pending.pending).toEqual({ presetId: 'overripe-2am', tempoBpm: 88 })
    const next = appReducer(scored(), { type: 'presetRequested', presetId: 'overripe-2am', tempoBpm: 88, immediate: true })
    expect(next.active.presetId).toBe('overripe-2am')
    expect(next.active.tempoBpm).toBe(88)
    expect(next.position).toEqual({ phraseIndex: 0, bar: 0, beat: 0 })
    expect(next.activeScore).toBeNull()
  })

  it('replaces repeated pending requests and reconciles applied changes', () => {
    const first = appReducer(initial(), { type: 'tempoRequested', tempoBpm: 80, immediate: false })
    const second = appReducer(first, { type: 'tempoRequested', tempoBpm: 90, immediate: false })
    expect(second.pending.tempoBpm).toBe(90)
    const withVariation = appReducer(second, { type: 'variationRequested', variation: 0.5, immediate: false })
    const recipe = { ...withVariation.active, tempoBpm: 90 }
    const applied = appReducer(withVariation, { type: 'changesApplied', recipe })
    expect(applied.active).toBe(recipe)
    expect(applied.pending).toEqual({ variation: 0.5 })
  })
})
