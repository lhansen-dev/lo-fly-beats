import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import App from './app/App.tsx'
import { ControllerProvider } from './app/ControllerContext'
import { SessionController } from './app/controller'
import { randomSessionSeed } from './app/seed'
import { createInitialState } from './app/state'
import { createAppStore } from './app/store'
import { loadCircuit } from './connectome/load'
import { createSettingsSaver, isStorageAvailable, loadSettings } from './app/persistence'
import { LearningClient } from './app/learningClient'
import { createLearningPersistence } from './app/learningPersistence'
import { BrainClient } from './app/brainClient'

const getStorage = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const store = createAppStore(createInitialState(loadSettings(getStorage)))
const saver = createSettingsSaver(getStorage, 500, () => store.dispatch({ type: 'storageUnavailable' }))
if (!isStorageAvailable(getStorage)) {
  store.dispatch({ type: 'storageUnavailable' })
}
const params = new URLSearchParams(window.location.search)
const learningExperiment = import.meta.env.DEV && params.get('learning') === '1'
// The fly's own brain composes unless the classic connectome walk is requested.
const brainComposer = !learningExperiment && params.get('composer') !== 'walk' && typeof Worker !== 'undefined'
const controller = new SessionController({
  store,
  createEngine: async () => (await import('./audio/engine')).getEngine(),
  loadGraph: () => loadCircuit(import.meta.env.BASE_URL),
  saveSettings: settings => saver.save(settings),
  randomSeed: randomSessionSeed,
  ...(brainComposer ? {
    createBrainClient: () => new BrainClient({ onStatus: brain => store.dispatch({ type: 'brainStatusChanged', brain }) }),
  } : {}),
  ...(learningExperiment ? {
    createLearningClient: (graph: import('./connectome/types').CircuitGraph) => new LearningClient({
      graph, persistence: createLearningPersistence(),
      onStatus: learning => store.dispatch({ type: 'learningStatusChanged', learning }),
    }),
  } : {}),
})
void controller.loadCircuit()
window.addEventListener('pagehide', event => { if (!event.persisted) controller.dispose(); saver.flush() })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ControllerProvider controller={controller}>
      <App />
    </ControllerProvider>
  </StrictMode>,
)
