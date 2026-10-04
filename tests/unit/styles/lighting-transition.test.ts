import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8')

const properties = [
  '--scene-wall',
  '--scene-window-sky',
  '--scene-glass-tint',
  '--scene-desk',
  '--scene-desk-edge',
  '--scene-light-color',
  '--scene-light-opacity',
  '--scene-shadow-opacity',
  '--ui-accent'
]

describe('lighting transitions', () => {
  it('registers and transitions every preset property', () => {
    for (const property of properties) {
      expect(appCss).toContain(`@property ${property}`)
      expect(appCss).toContain(`${property} 1.5s`)
    }
  })
})
