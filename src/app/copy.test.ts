// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControllerProvider } from './ControllerContext'
import { SessionController } from './controller'
import { createInitialState } from './state'
import { createAppStore } from './store'
import App from './App'
import NowPlaying from '../components/NowPlaying'
import { ABOUT_LINE, APP_TITLE, LOADING_TEXT, START_LABEL, TAGLINE, TRACK_TITLE } from './copy'

function render(node: ReturnType<typeof createElement>) {
  const store = createAppStore(createInitialState(null))
  const controller = new SessionController({ store, createEngine: async () => { throw new Error('unused') }, loadGraph: async () => { throw new Error('unused') }, saveSettings: () => {} })
  return renderToStaticMarkup(createElement(ControllerProvider, { controller, children: node }))
}

describe('application copy', () => {
  it('exports the exact copy strings', () => {
    expect(APP_TITLE).toBe('Lo-fly beats')
    expect(TAGLINE).toBe('Beats to relax / repeatedly fly into the same window to')
    expect(TRACK_TITLE).toBe('No Thoughts, Only Fruit')
    expect(LOADING_TEXT).toBe('Loading the fly-brain wiring…')
    expect(START_LABEL).toBe('Start listening')
    expect(ABOUT_LINE).toBe('Music shaped by real fly-brain wiring. The connections come from a real fruit fly; the scale, rhythm, instruments, and probability rules are authored choices.')
  })

  it('renders centralized copy and footer in App', () => {
    const markup = render(createElement(App))
    for (const expected of [
      '<h1>Lo-fly beats</h1>',
      'Beats to relax / repeatedly fly into the same window to',
      '<footer',
      'data-testid="about-line"',
      ABOUT_LINE,
      'href="#credits"',
      'Loading the fly-brain wiring…',
      'Start listening',
    ]) expect(markup).toContain(expected)
  })

  it('renders the track title in NowPlaying', () => {
    expect(render(createElement(NowPlaying))).toContain('Now playing: No Thoughts, Only Fruit')
  })
})
