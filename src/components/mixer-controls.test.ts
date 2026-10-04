import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControllerProvider } from '../app/ControllerContext'
import { SessionController } from '../app/controller'
import { createInitialState } from '../app/state'
import { createAppStore } from '../app/store'
import Mixer from './Mixer'
import App from '../app/App'

describe('Mixer', () => {
  it('renders labelled controls, defaults and updated mix without creating audio', () => {
    const store = createAppStore(createInitialState(null))
    const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
    const render = (node: React.ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node }))
    const ids = ['drums', 'bass', 'keys']
    let markup = render(createElement(Mixer))
    expect(markup).toContain('<legend>Mixer</legend>')
    for (const [id, initial] of ids.map((id, i) => [id, [80, 70, 60][i]] as const)) {
      expect(markup).toContain(`id="layer-${id}-level"`)
      expect(markup).toContain(`id="layer-${id}-mute"`)
      const input = markup.match(new RegExp(`<input[^>]*id="layer-${id}-level"[^>]*>`))?.[0]
      expect(input).toContain('type="range" min="0" max="100" step="1"')
      expect(input).toContain(`value="${initial}"`)
      expect(markup).toContain(`type="checkbox"`)
      expect(markup).toContain(`<output for="layer-${id}-level" role="none">${initial}%</output>`)
    }
    expect(markup).toContain('id="ambience-toggle"')
    expect(markup).toContain('checked=""')
    controller.setMix({ layers: { drums: { level: 0.33, muted: true } }, ambienceOn: false })
    markup = render(createElement(Mixer))
    expect(markup).toContain('<output for="layer-drums-level" role="none">33%</output>')
    expect(markup).toContain('id="layer-drums-mute" data-testid="layer-drums-mute" type="checkbox" checked=""')
    expect(markup).toContain('id="ambience-toggle" data-testid="ambience-toggle" type="checkbox"')
    expect(markup).not.toContain('id="ambience-toggle" data-testid="ambience-toggle" type="checkbox" checked=""')
    expect(markup).toContain('value="33"')
  })

  it('mounts Mixer and exactly one master-volume range in App', () => {
    const store = createAppStore(createInitialState(null))
    const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
    const markup = renderToStaticMarkup(createElement(ControllerProvider, { controller, children: createElement(App) }))
    expect(markup).toContain('<legend>Mixer</legend>')
    expect(markup.match(/data-testid="master-volume"/g)).toHaveLength(1)
    const masterVolumeInput = markup.match(/<input\b[^>]*data-testid="master-volume"[^>]*>/)
    expect(masterVolumeInput).not.toBeNull()
    expect(masterVolumeInput?.[0]).toMatch(/\btype="range"/)
    expect(markup).toContain('data-testid="scene-frame"')
    expect(markup).toContain('data-testid="start-listening"')
  })
})
