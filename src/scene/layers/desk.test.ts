import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Desk from './Desk'

describe('Desk', () => {
  it('renders the desk scene details with tokenized colors', () => {
    const markup = renderToStaticMarkup(createElement('svg', null, createElement(Desk)))
    expect(markup).toContain('class="desk"')
    expect(markup).toContain('class="homework"')
    expect(markup).toContain('class="pencil"')
    expect(markup).toContain('class="mug"')
    expect(markup).toContain('fill:var(--scene-desk)')
    expect(markup).toContain('var(--scene-desk-edge)')
    expect(markup.match(/<text/g)).toHaveLength(1)
    expect(markup).toMatch(/<text[^>]*>HW<\/text>/)
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toMatch(/rgba?\(/)
  })
})
