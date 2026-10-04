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
    expect(markup).toContain('var(--scene-rain)')
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toMatch(/rgba?\(/)
  })
})
