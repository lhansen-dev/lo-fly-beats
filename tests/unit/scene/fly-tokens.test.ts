import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const fly = readFileSync(resolve(process.cwd(), 'src/scene/fly/Fly.tsx'), 'utf8')
const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

describe('Fly colour tokens', () => {
  it('defines every token used by Fly without literal colours', () => {
    const names = [...fly.matchAll(/var\((--scene-[^)]+)\)/g)].map((match) => match[1])
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) expect(tokens).toContain(`${name}:`)
    expect(fly).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })
})
