// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import manifestText from '../../public/data/circuits/mbon-v1/manifest.json?raw'
import { manifestSchema } from '../connectome/schema'
import { createInitialState } from '../app/state'
import { createAppStore } from '../app/store'
import { ControllerProvider } from '../app/ControllerContext'
import { SessionController } from '../app/controller'
import { MAPPING_VERSION } from '../music/versions'
import Credits from './Credits'
import App from '../app/App'

const manifest = manifestSchema.parse(JSON.parse(manifestText))

function setup() {
  const store = createAppStore(createInitialState(null))
  const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
  return { store, render: (node: ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node })) }
}

describe('Credits', () => {
  it('shows loading and the authored mapping note', () => {
    const { render } = setup()
    const markup = render(createElement(Credits))
    expect(markup).toContain('id="credits"')
    expect(markup).toContain('Loading the fly-brain wiring…')
    expect(markup).toContain(`The musical mapping (version ${MAPPING_VERSION}) is authored and does not simulate neural activity.`)
    expect(markup).not.toContain('aria-live')
    expect(markup).not.toContain('role=')
  })

  it('renders manifest credits and attribution as an exact text-only paragraph', () => {
    const { store, render } = setup()
    store.dispatch({ type: 'circuitLoaded', manifest })
    const markup = render(createElement(Credits))
    expect(markup).toContain(`data-testid="credits-attribution">${manifest.license.attribution}</p>`)
    for (const expected of [
      'href="https://creativecommons.org/licenses/by/4.0/"',
      'href="https://doi.org/10.1101/2025.10.09.680999"',
      `href="${manifest.source.paperUrl}"`, 'MaleCNS', 'male-cns:v1.0',
      'University of Cambridge Department of Zoology', manifest.source.citation,
      ...manifest.extraction.rules,
      `The musical mapping (version ${MAPPING_VERSION}) is authored and does not simulate neural activity.`,
    ]) expect(markup).toContain(expected)
    expect(markup).not.toContain('aria-live')
    expect(markup).not.toContain('role=')
  })

  it('includes credits in the app', () => {
    const { render } = setup()
    expect(render(createElement(App))).toContain('id="credits"')
  })
})
