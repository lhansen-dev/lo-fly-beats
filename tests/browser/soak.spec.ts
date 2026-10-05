import { expect, test } from '@playwright/test'

test('sustained playback and five exports retain bounded resources', async ({ page, browser }) => {
  test.skip(process.env.SOAK !== '1', 'Set SOAK=1 to run the soak test')
  const minutes = Number(process.env.SOAK_MINUTES ?? 5)
  expect(Number.isFinite(minutes) && minutes > 0, 'SOAK_MINUTES must be positive').toBe(true)
  const duration = minutes * 60_000
  test.setTimeout(duration + 360_000)

  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))

  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })

  const started = Date.now()
  console.log(`Soak: ${minutes} minutes, ${browser.browserType().name()} ${browser.version()}`)
  while (Date.now() - started < duration) {
    await page.waitForTimeout(Math.min(30_000, duration - (Date.now() - started)))
    const diagnostics = JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}')
    expect(diagnostics.repeatEvents).toBe(1)
    expect(diagnostics.scoresHeld).toBeLessThanOrEqual(2)
    expect(diagnostics.keysActiveVoices).toBeLessThanOrEqual(8)
    expect(diagnostics.status).toBe('playing')
    expect(diagnostics.objectUrlsHeld).toBeLessThanOrEqual(1)
    console.log(`Soak sample ${Math.round((Date.now() - started) / 1000)}s: ${JSON.stringify(diagnostics)}`)
  }

  const heap = () => page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null)
  const before = await heap()
  for (let count = 0; count < 5; count += 1) {
    await page.getByTestId('export-button').click()
    await expect(page.getByTestId('export-status')).toHaveText('ready', { timeout: 60_000 })
    await expect.poll(async () => JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}').objectUrlsHeld).toBeLessThanOrEqual(1)
  }
  const after = await heap()
  console.log(`Soak heap bytes before exports: ${before}; after exports: ${after}`)
  await test.info().attach('soak-memory', { body: JSON.stringify({ minutes, browser: browser.version(), before, after }), contentType: 'application/json' })

  expect(pageErrors).toEqual([])
})
