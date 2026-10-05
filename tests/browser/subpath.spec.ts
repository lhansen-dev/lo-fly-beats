import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

let server: ChildProcess | undefined
test.beforeAll(async () => {
  test.skip(test.info().project.name !== 'chromium', 'Subdirectory acceptance uses Chromium')
  server = spawn(process.execPath, [fileURLToPath(new URL('../../scripts/serve-subpath.mjs', import.meta.url))], { stdio: ['ignore', 'pipe', 'pipe'] })
  const child = server
  await new Promise<void>((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Subdirectory server did not start: ${output}`)), 10_000)
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Subdirectory server exited (${code}): ${output}`)) })
    child.stderr?.on('data', data => { output += String(data) })
    child.stdout?.on('data', data => {
      output += String(data)
      if (output.includes('Serving dist at')) { clearTimeout(timer); resolve() }
    })
  })
})

test.afterAll(async () => {
  if (!server || server.exitCode !== null) return
  const child = server
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL') }, 3000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
    child.kill('SIGTERM')
  })
})

test('production assets and circuit load beneath a nested path', async ({ page }) => {
  const errors: Error[] = []
  page.on('pageerror', error => errors.push(error))
  await page.goto('http://localhost:4174/nested/lofly/')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  expect(errors).toEqual([])
})
