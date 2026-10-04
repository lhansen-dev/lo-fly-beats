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
const controller = new SessionController({
  store,
  createEngine: async () => (await import('./audio/engine')).getEngine(),
  loadGraph: () => loadCircuit(import.meta.env.BASE_URL),
  saveSettings: settings => saver.save(settings),
  randomSeed: randomSessionSeed,
})
void controller.loadCircuit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ControllerProvider controller={controller}>
      <App />
    </ControllerProvider>
  </StrictMode>,
)
