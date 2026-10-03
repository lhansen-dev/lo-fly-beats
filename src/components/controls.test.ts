import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControllerProvider } from '../app/ControllerContext'
import { SessionController } from '../app/controller'
import { createInitialState } from '../app/state'
import { createAppStore } from '../app/store'
import type { CircuitManifest } from '../connectome/types'
import TransportControls from './TransportControls'

function setup() {
  const store = createAppStore(createInitialState(null))
  const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
  return { store, render: (node: ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node })) }
}

describe('TransportControls', () => {
  it('renders the initial transport state', () => {
    const { render } = setup()
    const markup = render(createElement(TransportControls))
    expect(markup).toContain('data-testid="start-listening"')
    expect(markup).toContain('disabled')
    expect(markup).toContain('data-testid="engine-status"')
    expect(markup).toContain('>idle<')
    expect(markup).toContain('data-testid="position"')
    expect(markup).toContain('Phrase 1 · Bar 1 · Beat 1')
  })

  it('enables start listening once the circuit is ready', () => {
    const { store, render } = setup()
    store.dispatch({ type: 'circuitLoaded', manifest: { counts: { neurons: 97, connections: 936 } } as unknown as CircuitManifest })
    const markup = render(createElement(TransportControls))
    expect(markup).toContain('data-testid="start-listening"')
    expect(markup).not.toContain('disabled')
  })

  it('renders pause toggle while playing', () => {
    const { store, render } = setup()
    store.dispatch({ type: 'engineStatusChanged', status: 'playing' })
    const markup = render(createElement(TransportControls))
    expect(markup).toContain('data-testid="play-toggle"')
    expect(markup).toContain('Pause')
    expect(markup).not.toContain('start-listening')
  })
})
