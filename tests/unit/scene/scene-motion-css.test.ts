import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/scene/scene.css'), 'utf8')

describe('scene motion CSS', () => {
  it('animates rain streaks continuously', () => {
    expect(css).toContain('@keyframes rain-fall')
    expect(css).toContain('.rain-streak')
    expect(css).toContain('infinite')
  })
})
