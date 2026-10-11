import { lazy, Suspense, type CSSProperties } from 'react'
import { ABOUT_LINE, APP_TITLE, BRAIN_ABOUT_LINE, TAGLINE } from './copy'
import { useController } from './ControllerContext'
import { useAppState } from './store'
import { getPreset } from '../presets/presets'
import SceneFrame from '../scene/SceneFrame'
import { visualCssVars } from './visualVars'
import DiagnosticsPanel from '../components/DiagnosticsPanel'
import NowPlaying from '../components/NowPlaying'
import StatusJoke from '../components/StatusJoke'
import TransportControls from '../components/TransportControls'
import PresetPicker from '../components/PresetPicker'
import TempoControl from '../components/TempoControl'
import VariationControl from '../components/VariationControl'
import CircuitStatus from '../components/CircuitStatus'
import StorageNote from '../components/StorageNote'
import NewBeatButton from '../components/NewBeatButton'
import PendingChanges from '../components/PendingChanges'
import Mixer from '../components/Mixer'
import AnimationToggle from '../components/AnimationToggle'
import ExportPanel from '../components/ExportPanel'
import ExplanationPanel from '../components/explanation/ExplanationPanel'
import Credits from '../components/Credits'
import PlaybackStatus from '../components/PlaybackStatus'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import Icon from '../components/Icon'
import CircuitScanner from '../components/scanner/CircuitScanner'
import FlyBrainPanel from '../components/brain/FlyBrainPanel'
import '../components/brain/brain.css'

const LearningLab = import.meta.env.DEV ? lazy(() => import('../components/learning/LearningLab')) : null

export default function App() {
  const controller = useController()
  useKeyboardShortcuts()
  const presetId = useAppState(state => state.active.presetId)
  const brainComposing = useAppState(state => state.brain !== null && state.brain.status !== 'error')
  const walkRequested = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('composer') === 'walk'
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'
  const learningExperiment = import.meta.env.DEV && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('learning') === '1'

  return <main className="app" data-preset={presetId} style={visualCssVars(getPreset(presetId).visual) as CSSProperties}>
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><Icon name="fly" /></span><span>LO-FLY<span className="brand-divider"> / </span><span className="brand-caption">CONNECTOME RADIO</span></span></div>
      <span className="header-note"><span className="status-dot" /> A small experiment in slowing down</span>
    </header>
    <div className="intro">
      <div><p className="eyebrow">A listening room, wired a little differently.</p><h1>{APP_TITLE}<span className="title-period">.</span></h1><p className="tagline">{TAGLINE}</p></div>
      <p className="intro-note">Real fly-brain connections.<br />Soft keys. Slow drums. Zero rush.</p>
    </div>
    <PlaybackStatus />
    <div className="app-layout">
      <section className="listening-panel" aria-label="Listening room">
        <div className="scene-wrapper"><SceneFrame /><div className="scene-label" aria-hidden="true"><span className="status-dot" /> THE LISTENING ROOM</div><span className="scene-caption" aria-hidden="true">a very small study session</span></div>
        <div className="player-content"><NowPlaying /><TransportControls /><StatusJoke /></div>
        <div className="room-footer"><AnimationToggle /><span className="keyboard-hint"><kbd>Space</kbd> play / pause <span>·</span> <kbd>N</kbd> new beat</span></div>
      </section>
      <section className="app-controls controls-panel" aria-labelledby="session-title">
        <div className="panel-heading"><div><p className="eyebrow">MAKE YOURSELF AT HOME</p><h2 id="session-title">Shape your session</h2></div><span className="panel-number">01</span></div>
        <PresetPicker />
        <div className="parameter-controls"><TempoControl /><VariationControl /></div>
        <Mixer />
        <div className="session-actions"><NewBeatButton /><ExportPanel /></div>
        <PendingChanges /><StorageNote />
      </section>
    </div>
    <FlyBrainPanel />
    {walkRequested && <p className="composer-switch composer-switch--walk">The classic seeded walk is composing. <a href="./">Let the fly compose</a></p>}
    <CircuitScanner />
    <div className="circuit-load"><CircuitStatus /></div>
    <div className="about-section"><ExplanationPanel /><Credits /></div>
    <footer className="app-footer"><p data-testid="about-line">{brainComposing ? BRAIN_ABOUT_LINE : ABOUT_LINE}</p><a href="#credits">Credits</a><span>Made for the slow moments.</span></footer>
    {debugMode && <DiagnosticsPanel getDiagnostics={() => controller.getDiagnostics()} onSimulateInterruption={() => controller.simulateInterruption()} />}
    {learningExperiment && LearningLab && <Suspense fallback={<p>Loading phrase experiment…</p>}><LearningLab /></Suspense>}
  </main>
}
