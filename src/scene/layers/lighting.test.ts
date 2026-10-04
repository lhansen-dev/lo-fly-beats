import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Lighting from './Lighting'

describe('Lighting', () => {
  it('renders the lamp and token-based lighting in order', () => {
    const markup = renderToStaticMarkup(createElement('svg', null, createElement(Lighting)))
    expect(markup.indexOf('class="lamp"')).toBeLessThan(markup.indexOf('class="lighting"'))
    for (const expected of [
      'var(--scene-light-color)',
      'var(--scene-light-opacity)',
      'var(--scene-lamp-shade)',
      'url(#scene-light-cone-gradient)',
    ]) expect(markup).toContain(expected)
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toMatch(/rgba?\(/)
  })
})
