import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Fly from './Fly'

const markup = renderToStaticMarkup(createElement('svg', null, createElement(Fly)))

describe('Fly', () => {
  it('renders the fly groups and six sleeves without unsupported shapes or literal colours', () => {
    for (const name of ['fly', 'fly-body', 'fly-wings', 'fly-head', 'fly-eye-shine', 'fly-headphones', 'fly-hands-front']) {
      expect(markup.match(new RegExp(`class="${name}"`, 'g'))).toHaveLength(1)
    }
    expect([...markup.matchAll(/data-sleeve="([^"]+)"/g)].map((match) => match[1])).toEqual([
      'front-left', 'front-right', 'middle-left', 'middle-right', 'back-left', 'back-right',
    ])
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba\(/)
    expect(markup).not.toMatch(/<text|<rect|<polygon/)
    expect(markup).not.toContain('scene-fly-silhouette')
  })

  it('draws every sleeve distinct from the torso with its own dark outline', () => {
    const torsoTag = markup.match(/<path\b[^>]*data-part="torso"[^>]*>/)?.[0]
    expect(torsoTag).toBeDefined()
    const torsoFillToken = torsoTag!.match(/var\((--[a-z-]+)\)/)?.[1]
    expect(torsoFillToken).toBeDefined()

    for (const name of ['front-left', 'front-right', 'middle-left', 'middle-right', 'back-left', 'back-right']) {
      const sleeveTag = markup.match(new RegExp(`<path\\b[^>]*data-sleeve="${name}"[^>]*>`))?.[0]
      const outlineTag = markup.match(new RegExp(`<path\\b[^>]*data-sleeve-outline="${name}"[^>]*>`))?.[0]
      expect(sleeveTag).toBeDefined()
      expect(outlineTag).toBeDefined()
      expect(sleeveTag!.match(/var\((--[a-z-]+)\)/)?.[1]).not.toBe(torsoFillToken)
      expect(outlineTag).toContain('var(--scene-fly-dark)')
      expect(outlineTag!.match(/ d="([^"]+)"/)?.[1]).toBe(sleeveTag!.match(/ d="([^"]+)"/)?.[1])
      expect(Number(outlineTag!.match(/stroke-width="(\d+)"/)?.[1])).toBeGreaterThan(Number(sleeveTag!.match(/stroke-width="(\d+)"/)?.[1]))
      expect(markup.indexOf(outlineTag!)).toBeLessThan(markup.indexOf(sleeveTag!))
    }
  })

  it('keeps all geometry within scene bounds', () => {
    const points: number[][] = []
    for (const [, d] of markup.matchAll(/ d="([^"]+)"/g)) {
      expect(d).toMatch(/^[MLQCSTZ\d\s.,-]+$/)
      const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]])
    }
    for (const tag of markup.matchAll(/<(circle|ellipse)\b([^>]*)>/g)) {
      const attr = tag[2]
      const value = (name: string) => Number(attr.match(new RegExp(`${name}="([^"]+)"`))![1])
      const cx = value('cx'), cy = value('cy')
      const radius = Math.max(...['r', 'rx', 'ry'].filter((key) => new RegExp(`${key}="`).test(attr)).map(value))
      points.push([cx - radius, cy - radius], [cx + radius, cy + radius])
    }
    for (const [, attrs] of markup.matchAll(/<line\b([^>]*)>/g)) {
      points.push(['x1', 'y1', 'x2', 'y2'].map((key) => Number(attrs.match(new RegExp(`${key}="([^"]+)"`))![1])))
    }
    expect(points.length).toBeGreaterThan(0)
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(820)
      expect(x).toBeLessThanOrEqual(1260)
      expect(y).toBeGreaterThanOrEqual(250)
      expect(y).toBeLessThanOrEqual(720)
    }
  })
})
