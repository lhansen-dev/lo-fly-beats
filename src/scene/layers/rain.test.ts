import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Rain from './Rain'

describe('Rain', () => {
  it('renders rain clipped to the window using the scene color token', () => {
    const markup = renderToStaticMarkup(createElement('svg', null, createElement(Rain)))

    expect(markup).toContain('class="rain"')
    expect(markup).toContain('clip-path="url(#scene-window-clip)"')
    expect(markup.match(/class="rain-streak"/g)).toHaveLength(18)
    expect(markup.match(/class="rain-drop"/g)).toHaveLength(10)
    expect(markup.match(/animation-delay:\d+ms/g)).toHaveLength(18)
    expect(markup.match(/animation-duration:\d+ms/g)).toHaveLength(18)
    expect(markup).toContain('var(--scene-rain)')
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toMatch(/rgba?\(/)
  })

  it('renders identical timing for the same seed and different timing for different seeds', () => {
    const render = (sessionSeed: number) => renderToStaticMarkup(createElement('svg', null, createElement(Rain, { sessionSeed })))

    expect(render(1)).toBe(render(1))
    expect(render(1)).not.toBe(render(2))
  })
})
