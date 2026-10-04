import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControllerProvider } from '../app/ControllerContext'
import { SessionController } from '../app/controller'
import { createInitialState } from '../app/state'
import { createAppStore } from '../app/store'
import AnimationToggle from './AnimationToggle'
import App from '../app/App'

function setup() {
  const store = createAppStore(createInitialState(null))
  const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
  return { store, render: (node: ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node })) }
}

describe('AnimationToggle', () => {
  it('follows the server reduced-motion snapshot when the setting is unset', () => {
    const { render } = setup()
    const markup = render(createElement(AnimationToggle))
    expect(markup).toContain('data-testid="animation-toggle"')
    expect(markup).toContain('Animate scene')
    expect(markup).toMatch(/data-testid="animation-toggle"[^>]*checked/)
  })

  it('renders unchecked when animation is explicitly disabled', () => {
    const { store, render } = setup()
    store.dispatch({ type: 'animationToggled', enabled: false })
    const markup = render(createElement(AnimationToggle))
    expect(markup).toContain('data-testid="animation-toggle"')
    expect(markup).not.toMatch(/data-testid="animation-toggle"[^>]*checked/)
  })

  it('is included in App', () => {
    const { render } = setup()
    expect(render(createElement(App))).toContain('data-testid="animation-toggle"')
  })
})
