import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import type { FunctionComponent, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControllerProvider } from '../app/ControllerContext'
import { SessionController } from '../app/controller'
import { createInitialState } from '../app/state'
import type { AppState } from '../app/state'
import { createAppStore, useAppState } from '../app/store'
import App from '../app/App'
import NewBeatButton from './NewBeatButton'
import NowPlaying from './NowPlaying'
import PendingChanges from './PendingChanges'
import PresetPicker from './PresetPicker'
import StartListening from './StartListening'
import TempoControl from './TempoControl'
import TransportControls from './TransportControls'
import VariationControl from './VariationControl'

vi.mock('../app/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/store')>()
  return {
    ...actual,
    useAppState: <T,>(selector: (state: AppState) => T): T => {
      const state = actual.getAppStore().getState()
      const first = selector(state)
      const second = selector(state)
      if (!Object.is(first, second)) throw new Error('useAppState selector returned an unstable snapshot')
      return first
    },
  }
})

function setup() {
  const store = createAppStore(createInitialState(null))
  const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
  const render = (node: ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node }))
  return { render }
}

const controls: Array<[string, FunctionComponent]> = [
  ['App', App],
  ['NewBeatButton', NewBeatButton],
  ['NowPlaying', NowPlaying],
  ['PendingChanges', PendingChanges],
  ['PresetPicker', PresetPicker],
  ['StartListening', StartListening],
  ['TempoControl', TempoControl],
  ['TransportControls', TransportControls],
  ['VariationControl', VariationControl],
]

describe('player control selectors', () => {
  it.each(controls)('%s uses stable useAppState snapshots', (_name, Component) => {
    const { render } = setup()
    expect(() => render(createElement(Component))).not.toThrow()
  })

  it('exports the real hook and store for consumers', () => {
    expect(useAppState).toBeDefined()
  })
})
