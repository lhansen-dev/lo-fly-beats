import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControllerProvider } from '../app/ControllerContext'
import { SessionController } from '../app/controller'
import { createInitialState } from '../app/state'
import { createAppStore } from '../app/store'
import type { PhraseScore } from '../music/types'
import ExportPanel from './ExportPanel'

function setup() {
  const store = createAppStore(createInitialState(null))
  const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
  return { store, render: (node: ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node })) }
}

describe('ExportPanel', () => {
  it('renders export availability, progress, download, and dismissal states', () => {
    const { store, render } = setup()
    let markup = render(createElement(ExportPanel))
    expect(markup).toContain('About 29 seconds: 8 bars at 72 BPM plus a 2-second tail. Pending changes are not included.')
    expect(markup).toMatch(/data-testid="export-button"[^>]*disabled/)
    expect(markup).not.toContain('role="status"')
    expect(markup).toContain('data-testid="export-status"')
    expect(markup).not.toContain('export-download')

    store.dispatch({ type: 'phraseStarted', score: { scoreVersion: 1 } as PhraseScore })
    markup = render(createElement(ExportPanel))
    expect(markup).not.toMatch(/data-testid="export-button"[^>]*disabled/)

    store.dispatch({ type: 'exportStateChanged', exportState: { status: 'ready', fileName: 'lofly-rainy-windowsill-seed-00000001.wav', url: 'blob:x', message: null } })
    markup = render(createElement(ExportPanel))
    expect(markup).toContain('data-testid="export-download"')
    expect(markup).toContain('download="lofly-rainy-windowsill-seed-00000001.wav"')
    expect(markup).toContain('href="blob:x"')
    expect(markup).toContain('>Done</button>')

    store.dispatch({ type: 'exportStateChanged', exportState: { status: 'rendering' } })
    markup = render(createElement(ExportPanel))
    expect(markup).toMatch(/data-testid="export-button"[^>]*disabled/)
  })
})
