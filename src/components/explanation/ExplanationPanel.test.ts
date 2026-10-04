import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControllerProvider } from '../../app/ControllerContext'
import { SessionController } from '../../app/controller'
import { createInitialState } from '../../app/state'
import { createAppStore } from '../../app/store'
import type { CircuitGraph } from '../../connectome/types'
import type { TraceStep } from '../../music/types'
import { MAPPING_VERSION } from '../../music/versions'
import App from '../../app/App'
import ExplanationPanel from './ExplanationPanel'
import RecentChoicesList from './RecentChoicesList'

function setup() {
  const store = createAppStore(createInitialState(null))
  const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
  return { render: (node: ReactNode) => renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node })) }
}

describe('ExplanationPanel', () => {
  it('renders the explanation and its versioned sections without live announcements', () => {
    const markup = setup().render(createElement(ExplanationPanel))
    expect(markup).toContain('data-testid="explanation"')
    expect(markup).toContain('How the beat is made')
    for (const heading of ['The circuit', 'Recent choices', "This phrase's chords", 'Rules we wrote', 'Versions']) expect(markup).toContain(`<h2>${heading.replace("'", '&#x27;')}</h2>`)
    expect(markup).toContain(`Mapping version: ${MAPPING_VERSION}`)
    expect(markup).not.toContain(['aria', 'live'].join('-'))
    expect(markup).not.toContain(['role="', 'status"'].join(''))
  })

  it('is included in App', () => expect(setup().render(createElement(App))).toContain('data-testid="explanation"'))
})

describe('RecentChoicesList', () => {
  const graph = { neurons: new Map([
    ['1', { id: '1', type: 'A', instance: null, class: null, superclass: null, somaSide: null }],
    ['2', { id: '2', type: 'B', instance: null, class: null, superclass: null, somaSide: null }],
  ]), startNeuronIds: ['1'] } as Pick<CircuitGraph, 'neurons' | 'startNeuronIds'>
  const edge: TraceStep = { kind: 'edge', beat: 1, beatInBar: 1, bar: 0, neuronId: '2', from: '1', synapseCount: 3, probability: 0.5, neuronType: 'B', uses: [] }
  const start: TraceStep = { kind: 'start', beat: 0, beatInBar: 0, bar: 0, neuronId: '1', neuronType: 'A', uses: [] }

  it('describes edges and authored start rules with graph metadata', () => {
    const edgeMarkup = renderToStaticMarkup(createElement(RecentChoicesList, { steps: [edge], graph }))
    expect(edgeMarkup).toContain('data-source="1"')
    expect(edgeMarkup).toContain('data-target="2"')
    expect(edgeMarkup).toContain('data-synapses="3"')
    expect(edgeMarkup).toContain('Real connection')
    expect(renderToStaticMarkup(createElement(RecentChoicesList, { steps: [start], graph }))).toContain('Authored rule')
  })
})
