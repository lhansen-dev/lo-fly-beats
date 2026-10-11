import type { CircuitErrorCode, CircuitManifest } from '../connectome/types'
import type { EngineStatus } from '../audio/engine'
import { DEFAULT_MIX } from '../audio/rig'
import type { MixSettings } from '../audio/rig'
import type { PhraseScore, SessionRecipe } from '../music/types'
import { DEFAULT_PRESET_ID, getPreset } from '../presets/presets'
import type { PresetId } from '../presets/types'
import { DEFAULT_SESSION_SEED } from '../music/versions'
import type { LearningStatus } from './learningClient'
import type { BrainStatus } from './brainClient'

export interface AppState {
  circuit: { status: 'loading' | 'ready' | 'error'; manifest: CircuitManifest | null; error: { code: CircuitErrorCode | 'unknown'; message: string } | null }
  engineStatus: EngineStatus
  audioNotice: string | null
  learning: LearningStatus | null
  /** The fly's brain composer; null when the connectome walk composes. */
  brain: BrainStatus | null
  active: SessionRecipe
  pending: Partial<Pick<SessionRecipe, 'tempoBpm' | 'variation' | 'sessionSeed' | 'presetId'>>
  position: { phraseIndex: number; bar: number; beat: number }
  mix: MixSettings
  activeScore: PhraseScore | null
  exportState: { status: 'idle' | 'preparing' | 'rendering' | 'encoding' | 'ready' | 'error'; fileName: string | null; url: string | null; message: string | null }
  ui: { animationEnabled: boolean | null; storageAvailable: boolean }
}

export interface RestoredSettings {
  mappingVersion: number
  presetVersion: number
  presetId: PresetId
  sessionSeed: number
  tempoBpm: number
  variation: number
  mix: MixSettings
  animationEnabled: boolean | null
}

export type AppAction =
  | { type: 'circuitLoading' }
  | { type: 'circuitLoaded'; manifest: CircuitManifest }
  | { type: 'circuitFailed'; code: CircuitErrorCode | 'unknown'; message: string }
  | { type: 'engineStatusChanged'; status: EngineStatus }
  | { type: 'audioNoticeChanged'; notice: string | null }
  | { type: 'learningStatusChanged'; learning: LearningStatus }
  | { type: 'brainStatusChanged'; brain: BrainStatus | null }
  | { type: 'tempoRequested'; tempoBpm: number; immediate: boolean }
  | { type: 'variationRequested'; variation: number; immediate: boolean }
  | { type: 'newBeatRequested'; sessionSeed: number; immediate: boolean }
  | { type: 'presetRequested'; presetId: PresetId; tempoBpm: number; immediate: boolean }
  | { type: 'changesApplied'; recipe: SessionRecipe }
  | { type: 'phraseStarted'; score: PhraseScore }
  | { type: 'positionChanged'; position: { phraseIndex: number; bar: number; beat: number } }
  | { type: 'mixChanged'; mix: MixSettings }
  | { type: 'exportStateChanged'; exportState: Partial<AppState['exportState']> }
  | { type: 'animationToggled'; enabled: boolean }
  | { type: 'storageUnavailable' }

export function createInitialState(restored: RestoredSettings | null): AppState {
  const presetId = restored?.presetId ?? DEFAULT_PRESET_ID
  return {
    circuit: { status: 'loading', manifest: null, error: null },
    engineStatus: 'idle',
    audioNotice: null,
    learning: null,
    brain: null,
    active: {
      recipeVersion: 1,
      presetId,
      sessionSeed: restored?.sessionSeed ?? DEFAULT_SESSION_SEED,
      variation: restored?.variation ?? 0,
      tempoBpm: restored?.tempoBpm ?? getPreset(presetId).tempoBpm,
    },
    pending: {},
    position: { phraseIndex: 0, bar: 0, beat: 0 },
    mix: restored?.mix ?? DEFAULT_MIX,
    activeScore: null,
    exportState: { status: 'idle', fileName: null, url: null, message: null },
    ui: { animationEnabled: restored?.animationEnabled ?? null, storageAvailable: true },
  }
}

function withoutPending(pending: AppState['pending'], ...keys: Array<keyof AppState['pending']>): AppState['pending'] {
  const next = { ...pending }
  for (const key of keys) delete next[key]
  return next
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'circuitLoading':
      return { ...state, circuit: { status: 'loading', manifest: null, error: null } }
    case 'circuitLoaded':
      return { ...state, circuit: { status: 'ready', manifest: action.manifest, error: null } }
    case 'circuitFailed':
      return { ...state, circuit: { status: 'error', manifest: null, error: { code: action.code, message: action.message } } }
    case 'engineStatusChanged':
      return { ...state, engineStatus: action.status }
    case 'audioNoticeChanged':
      return { ...state, audioNotice: action.notice }
    case 'learningStatusChanged':
      return { ...state, learning: action.learning }
    case 'brainStatusChanged':
      return { ...state, brain: action.brain }
    case 'tempoRequested':
      return action.immediate
        ? { ...state, active: { ...state.active, tempoBpm: action.tempoBpm }, pending: withoutPending(state.pending, 'tempoBpm') }
        : { ...state, pending: { ...state.pending, tempoBpm: action.tempoBpm } }
    case 'variationRequested':
      return action.immediate
        ? { ...state, active: { ...state.active, variation: action.variation }, pending: withoutPending(state.pending, 'variation') }
        : { ...state, pending: { ...state.pending, variation: action.variation } }
    case 'newBeatRequested':
      return action.immediate
        ? { ...state, active: { ...state.active, sessionSeed: action.sessionSeed }, pending: withoutPending(state.pending, 'sessionSeed'), position: { phraseIndex: 0, bar: 0, beat: 0 }, activeScore: null }
        : { ...state, pending: { ...state.pending, sessionSeed: action.sessionSeed } }
    case 'presetRequested':
      return action.immediate
        ? { ...state, active: { ...state.active, presetId: action.presetId, tempoBpm: action.tempoBpm }, pending: withoutPending(state.pending, 'presetId', 'tempoBpm'), position: { phraseIndex: 0, bar: 0, beat: 0 }, activeScore: null }
        : { ...state, pending: { ...state.pending, presetId: action.presetId, tempoBpm: action.tempoBpm } }
    case 'changesApplied': {
      const active = action.recipe
      const pending = { ...state.pending }
      for (const key of Object.keys(pending) as Array<keyof AppState['pending']>) {
        if (pending[key] === active[key]) delete pending[key]
      }
      return { ...state, active, pending }
    }
    case 'phraseStarted':
      return { ...state, activeScore: action.score, position: { phraseIndex: action.score.phraseIndex, bar: 0, beat: 0 } }
    case 'positionChanged':
      return { ...state, position: action.position }
    case 'mixChanged':
      return { ...state, mix: action.mix }
    case 'exportStateChanged':
      return { ...state, exportState: { ...state.exportState, ...action.exportState } }
    case 'animationToggled':
      return { ...state, ui: { ...state.ui, animationEnabled: action.enabled } }
    case 'storageUnavailable':
      return { ...state, ui: { ...state.ui, storageAvailable: false } }
    default:
      return state
  }
}
