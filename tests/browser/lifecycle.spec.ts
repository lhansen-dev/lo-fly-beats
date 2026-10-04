import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'Lifecycle acceptance runs in Chromium')
  await page.addInitScript(() => {
    const tracked = window as typeof window & { liveAudioContextsCreated: number }
    tracked.liveAudioContextsCreated = 0
    window.AudioContext = new Proxy(window.AudioContext, {
      construct(target, args, newTarget) {
        tracked.liveAudioContextsCreated += 1
        return Reflect.construct(target, args, newTarget)
      },
    })
  })
  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
})

test('audio stays idle for three seconds without interaction', async ({ page }) => {
  for (let sample = 0; sample < 6; sample += 1) {
    await page.waitForTimeout(500)
    const diagnostics = JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}')
    expect(diagnostics.status).toBe('idle')
    expect(diagnostics.repeatEvents).toBe(0)
    expect(diagnostics.keysActiveVoices).toBe(0)
  }
})

test('ten rapid preset selections keep one playback schedule', async ({ page }) => {
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  const presets = ['rainy-windowsill', 'overripe-2am', 'fruit-bowl-finals']
  const started = Date.now()
  for (let choice = 0; choice < 10; choice += 1) await page.getByTestId(`preset-${presets[(choice + 1) % 3]}`).check()
  expect(Date.now() - started).toBeLessThan(2000)
  await expect.poll(async () => JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}').repeatEvents).toBe(1)
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
})

test('export, preset change, and Play reuse one live engine with bounded voices', async ({ page }) => {
  test.setTimeout(90_000)
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await expect(page.getByTestId('export-button')).toBeEnabled()
  expect(await page.evaluate(() => (window as typeof window & { liveAudioContextsCreated: number }).liveAudioContextsCreated)).toBe(1)
  await page.getByTestId('export-button').click()
  await expect(page.getByTestId('export-status')).toHaveText('ready', { timeout: 60_000 })
  await page.getByTestId('preset-fruit-bowl-finals').check()
  await page.getByTestId('play-toggle').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await page.waitForTimeout(3000)
  const diagnostics = JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}')
  expect(diagnostics.repeatEvents).toBe(1)
  expect(diagnostics.keysActiveVoices).toBeLessThanOrEqual(8)
  expect(diagnostics.scoresHeld).toBeLessThanOrEqual(2)
  expect(await page.evaluate(() => (window as typeof window & { liveAudioContextsCreated: number }).liveAudioContextsCreated)).toBe(1)
})
