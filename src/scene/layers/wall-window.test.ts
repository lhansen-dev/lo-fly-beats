import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Wall from './Wall'
import Window from './Window'

describe('Wall and Window layers', () => {
  it('renders the wall using scene color tokens', () => {
    const markup = renderToStaticMarkup(createElement('svg', null, createElement(Wall)))
    expect(markup).toContain('class="wall"')
    expect(markup).toContain('class="wall-base"')
    expect(markup).toContain('fill:var(--scene-wall)')
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toMatch(/rgba?\(/)
  })

  it('renders the window with its child between sky and tint', () => {
    const markup = renderToStaticMarkup(createElement('svg', null, createElement(Window, null, createElement('g', { className: 'probe' }))))
    expect(markup).toContain('class="window"')
    expect(markup).toContain('id="scene-window-clip"')
    expect(markup).toContain('var(--scene-window-sky)')
    expect(markup).toContain('var(--scene-glass-tint)')
    expect(markup.indexOf('fill:var(--scene-window-sky)')).toBeLessThan(markup.indexOf('class="probe"'))
    expect(markup.indexOf('class="probe"')).toBeLessThan(markup.indexOf('fill:var(--scene-glass-tint)'))
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toMatch(/rgba?\(/)
  })
})
