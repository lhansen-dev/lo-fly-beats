import type { CSSProperties } from 'react'
import { ABOUT_LINE, APP_TITLE, TAGLINE } from './copy'
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

export default function App() {
  const controller = useController()
  useKeyboardShortcuts()
  const presetId = useAppState(state => state.active.presetId)
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'

  return <main className="app" data-preset={presetId} style={visualCssVars(getPreset(presetId).visual) as CSSProperties}>
    <header className="app-header">
      <h1>{APP_TITLE}</h1>
      <p>{TAGLINE}</p>
    </header>
    <PlaybackStatus />
    <div className="app-layout">
      <SceneFrame />
      <div className="app-controls">
        <CircuitStatus />
        <StorageNote />
        <NowPlaying />
        <StatusJoke />
        <TransportControls />
        <section className="controls-panel">
      <p>With focus on the scene or page: Space or K plays or pauses; N makes a new beat.</p>
      <PresetPicker />
      <Mixer />
      <AnimationToggle />
      <TempoControl />
      <VariationControl />
      <NewBeatButton />
      <PendingChanges />
          <ExportPanel />
        </section>
      </div>
    </div>
    <ExplanationPanel />
    <Credits />
    <footer className="app-footer"><p data-testid="about-line">{ABOUT_LINE}</p><a href="#credits">Credits</a></footer>
    {debugMode && <DiagnosticsPanel getDiagnostics={() => controller.getDiagnostics()} onSimulateInterruption={() => controller.simulateInterruption()} />}
  </main>
}
