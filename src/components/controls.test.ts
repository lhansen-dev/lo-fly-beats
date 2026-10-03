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
import TempoControl from './TempoControl'
import VariationControl from './VariationControl'
import PresetPicker from './PresetPicker'
import NewBeatButton from './NewBeatButton'

function setup() {
  const store = createAppStore(createInitialState(null))
  const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
  return { store, render: (node: ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node })) }
}

describe('TempoControl', () => {
  it('renders the active tempo and pending tempo requests', () => {
    const { store, render } = setup()
    let markup = render(createElement(TempoControl))
    expect(markup).toContain('data-testid="tempo"')
    expect(markup).toContain('type="range"')
    expect(markup).toContain('min="60"')
    expect(markup).toContain('max="100"')
    expect(markup).toContain('value="72"')
    expect(markup).toContain('72 BPM')

    store.dispatch({ type: 'tempoRequested', tempoBpm: 90, immediate: false })
    markup = render(createElement(TempoControl))
    expect(markup).toContain('value="90"')
  })
})

describe('VariationControl', () => {
  it('renders the active variation and pending variation requests', () => {
    const { store, render } = setup()
    let markup = render(createElement(VariationControl))
    expect(markup).toContain('data-testid="variation"')
    expect(markup).toContain('min="0"')
    expect(markup).toContain('max="100"')
    expect(markup).toContain('value="0"')

    store.dispatch({ type: 'variationRequested', variation: 0.5, immediate: true })
    markup = render(createElement(VariationControl))
    expect(markup).toContain('value="50"')
  })
})

describe('PresetPicker', () => {
  it('renders presets and selects the active or pending preset', () => {
    const { store, render } = setup()
    let markup = render(createElement(PresetPicker))
    expect(markup).toContain('<fieldset')
    expect(markup).toContain('<legend>Preset</legend>')
    expect(markup).toContain('type="radio"')
    expect(markup).toContain('data-testid="preset-rainy-windowsill"')
    expect(markup).toContain('data-testid="preset-overripe-2am"')
    expect(markup).toContain('data-testid="preset-fruit-bowl-finals"')
    expect(markup).toMatch(/preset-rainy-windowsill[^>]*checked/)

    store.dispatch({ type: 'presetRequested', presetId: 'fruit-bowl-finals', tempoBpm: 86, immediate: true })
    markup = render(createElement(PresetPicker))
    expect(markup).toMatch(/preset-fruit-bowl-finals[^>]*checked/)
  })
})

describe('NewBeatButton', () => {
  it('renders the new beat button', () => {
    const { render } = setup()
    const markup = render(createElement(NewBeatButton))
    expect(markup).toContain('data-testid="new-beat"')
    expect(markup).toContain('New beat')
  })
})

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
