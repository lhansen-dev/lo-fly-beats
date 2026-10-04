import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Scene from './Scene'

describe('Scene', () => {
  it('renders still and paused scene classes', () => {
    expect(renderToStaticMarkup(createElement(Scene, { still: true }))).toContain('class="scene scene--still"')
    expect(renderToStaticMarkup(createElement(Scene, { paused: true }))).toContain('scene--paused')
  })

  it('renders the accessible inline scene in layer order', () => {
    const markup = renderToStaticMarkup(createElement(Scene))
    for (const expected of [
      'viewBox="0 0 1600 900"',
      'role="img"',
      'aria-labelledby="scene-title scene-desc"',
      '<title id="scene-title">A fruit fly studying beside a banana</title>',
      'id="scene-desc"',
    ]) expect(markup).toContain(expected)

    const layers = ['wall', 'window', 'rain', 'lamp', 'lighting', 'desk', 'homework', 'fly', 'banana']
      .map((name) => markup.indexOf(`class="${name}"`))
    expect(layers.every((index) => index >= 0)).toBe(true)
    expect(layers.every((index, position) => position === 0 || layers[position - 1] < index)).toBe(true)
    for (const name of ['fly', 'banana']) expect(markup.match(new RegExp(`class="${name}"`, 'g'))).toHaveLength(1)
    expect(markup.match(/<text/g)).toHaveLength(1)
    expect(markup).toMatch(/<text[^>]*>HW<\/text>/)
    expect(markup).not.toMatch(/<image|<foreignObject|href="http|@font-face/)
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toMatch(/rgba?\(/)
    expect(markup.length).toBeLessThan(150_000)
  })
})
