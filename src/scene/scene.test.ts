import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Scene from './Scene'

describe('Scene', () => {
  it('renders still and paused scene classes', () => {
    expect(renderToStaticMarkup(createElement(Scene, { still: true }))).toContain('class="scene scene--still"')
    expect(renderToStaticMarkup(createElement(Scene, { paused: true }))).toContain('scene--paused')
  })

  it('renders an accessible scene with a decorative WebGL canvas', () => {
    const markup = renderToStaticMarkup(createElement(Scene))
    for (const expected of [
      'tabindex="0"',
      'role="img"',
      'aria-labelledby="scene-title"',
      'aria-describedby="scene-desc"',
      'A fruit fly studying beside a banana',
      'id="scene-desc"',
    ]) expect(markup).toContain(expected)

    expect(markup).toContain('<canvas')
    expect(markup).toContain('data-renderer="loading"')
    expect(markup).toMatch(/<canvas[^>]*aria-hidden="true"/)
    expect(markup).toContain('red compound eyes')
    expect(markup).toContain('six jointed legs')
    expect(markup).not.toContain('<svg')
  })
})
