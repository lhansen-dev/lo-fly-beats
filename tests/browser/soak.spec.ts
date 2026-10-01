import { expect, test } from '@playwright/test'

test('playback stays stable for five minutes', async ({ page }) => {
  test.skip(process.env.SOAK !== '1', 'Set SOAK=1 to run the five-minute soak test')
  test.setTimeout(420_000)

  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))

  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await page.getByTestId('start-restart').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })

  for (let sample = 0; sample < 10; sample += 1) {
    await page.waitForTimeout(30_000)
    const diagnostics = JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}')
    expect(diagnostics.repeatEvents).toBe(1)
    expect(diagnostics.scoresHeld).toBeLessThanOrEqual(2)
    expect(diagnostics.keysActiveVoices).toBeLessThanOrEqual(8)
    expect(diagnostics.status).toBe('playing')
  }

  expect(pageErrors).toEqual([])
})
