import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Banana from './Banana'

describe('Banana', () => {
  it('renders a token-colored banana without literal colors or text', () => {
    const markup = renderToStaticMarkup(createElement('svg', null, createElement(Banana)))
    expect(markup).toContain('class="banana"')
    expect(markup).toContain('var(--scene-banana)')
    expect(markup).toContain('var(--scene-banana-spot)')
    expect(markup).toContain('var(--scene-banana-stem)')
    expect(markup).toContain('var(--scene-shadow-opacity)')
    expect(markup).not.toContain('<text')
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toMatch(/rgba?\(/)
  })
})
