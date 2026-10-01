import { expect, test } from '@playwright/test'

test('live playback starts, pauses, resumes, and releases voices', async ({ page }) => {
  test.setTimeout(90_000)

  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))

  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await page.getByTestId('start-restart').click()

  const status = page.getByTestId('engine-status')
  const position = page.getByTestId('position')
  await expect(status).toHaveText('playing', { timeout: 10_000 })
  const firstPosition = await position.textContent()
  await expect.poll(() => position.textContent(), { timeout: 3_000 }).not.toBe(firstPosition)

  const playToggle = page.getByTestId('play-toggle')
  await playToggle.click()
  const pausedPosition = await position.textContent()
  await page.waitForTimeout(1_500)
  await expect(position).toHaveText(pausedPosition ?? '')

  await playToggle.click()
  await expect.poll(() => position.textContent(), { timeout: 3_000 }).not.toBe(pausedPosition)

  for (let click = 0; click < 20; click += 1) {
    await playToggle.click()
  }
  await expect(status).toHaveText('playing')
  const diagnostics = page.getByTestId('diagnostics')
  expect(JSON.parse((await diagnostics.textContent()) ?? '{}').repeatEvents).toBe(1)

  await playToggle.click()
  await page.waitForTimeout(2_500)
  expect(JSON.parse((await diagnostics.textContent()) ?? '{}').keysActiveVoices).toBe(0)
  expect(pageErrors).toEqual([])
})
