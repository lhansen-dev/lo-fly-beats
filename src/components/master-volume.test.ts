import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControllerProvider } from '../app/ControllerContext'
import { SessionController } from '../app/controller'
import { createInitialState } from '../app/state'
import { createAppStore } from '../app/store'
import MasterVolume from './MasterVolume'

describe('MasterVolume', () => {
  it('renders a labelled range and percentage without creating an engine', () => {
    const store = createAppStore(createInitialState(null))
    let engineCreations = 0
    const controller = new SessionController({ store, createEngine: async () => { engineCreations++; throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
    const render = (node: ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node }))

    let markup = render(createElement(MasterVolume))
    expect(markup).toContain('<label>Master volume')
    expect(markup).toContain('data-testid="master-volume"')
    expect(markup).toContain('type="range"')
    expect(markup).toContain('min="0"')
    expect(markup).toContain('max="100"')
    expect(markup).toContain('step="1"')
    expect(markup).toContain('value="80"')
    expect(markup).toContain('<output>80%</output>')
    expect(engineCreations).toBe(0)

    controller.setMix({ masterVolume: 0.37 })
    markup = render(createElement(MasterVolume))
    expect(markup).toContain('value="37"')
    expect(markup).toContain('<output>37%</output>')

    controller.setMix({ masterVolume: 0 })
    markup = render(createElement(MasterVolume))
    expect(markup).toContain('value="0"')
    expect(markup).toContain('<output>0%</output>')
    expect(engineCreations).toBe(0)
  })
})
