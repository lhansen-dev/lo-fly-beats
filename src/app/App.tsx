import type { CSSProperties } from 'react'
import { useController } from './ControllerContext'
import { useAppState } from './store'
import { getPreset } from '../presets/presets'
import SceneFrame from '../scene/SceneFrame'
import { visualCssVars } from './visualVars'
import DiagnosticsPanel from '../components/DiagnosticsPanel'
import NowPlaying from '../components/NowPlaying'
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

export default function App() {
  const controller = useController()
  const presetId = useAppState(state => state.active.presetId)
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'

  return <main className="app" data-preset={presetId} style={visualCssVars(getPreset(presetId).visual) as CSSProperties}>
    <header className="app-header">
      <h1>Lo-fly beats</h1>
      <p>Beats to relax / repeatedly fly into the same window to</p>
    </header>
    <div className="app-layout">
      <SceneFrame />
      <div className="app-controls">
        <CircuitStatus />
        <StorageNote />
        <NowPlaying />
        <TransportControls />
        <section className="controls-panel">
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
    {debugMode && <DiagnosticsPanel getDiagnostics={() => controller.getDiagnostics()} onSimulateInterruption={() => controller.simulateInterruption()} />}
  </main>
}
