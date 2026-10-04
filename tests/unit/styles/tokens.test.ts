import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRESETS } from '../../../src/presets/presets'
import { contrastRatio, readCssColor } from '../helpers/contrast'

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')
const color = (name: string) => readCssColor(css, name)

describe('design tokens', () => {
  it('calculates the maximum black-white contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
  })

  it('meets text, border, focus, and preset accent contrast requirements', () => {
    for (const text of ['ui-text', 'ui-muted']) {
      for (const background of ['ui-bg', 'ui-surface']) {
        expect(contrastRatio(color(text), color(background))).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const foreground of ['ui-border', 'focus']) {
      for (const background of ['ui-bg', 'ui-surface']) {
        expect(contrastRatio(color(foreground), color(background))).toBeGreaterThanOrEqual(3)
      }
    }
    for (const preset of Object.values(PRESETS)) {
      expect(contrastRatio(preset.visual.uiAccent, color('ui-surface'))).toBeGreaterThanOrEqual(3)
    }
  })

  it('includes the token documentation and loads tokens before app styles', () => {
    for (const required of ['Contrast ratios', '--space-1', '--radius', '--font-sans', '--scene-wall']) {
      expect(css).toContain(required)
    }
    const main = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')
    expect(main).toContain("import './styles/tokens.css'")
  })
})
