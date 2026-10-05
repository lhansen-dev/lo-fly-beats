import { expect, test } from '@playwright/test'

test('circuit loading failure can be retried', async ({ page }) => {
  await page.route('**/adjacency.bin.gzip', route => route.fulfill({ status: 404, body: 'missing' }))
  await page.goto('/')

  await expect(page.getByTestId('circuit-status')).toContainText("couldn't be loaded")
  await expect(page.getByTestId('circuit-retry')).toBeVisible()
  await expect(page.getByTestId('start-listening')).toBeDisabled()

  await page.unroute('**/adjacency.bin.gzip')
  await page.getByTestId('circuit-retry').click()
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await expect(page.getByTestId('start-listening')).toBeEnabled()
})

test('tampered circuit bytes fail the checksum', async ({ page }) => {
  await page.route('**/adjacency.bin.gzip', async route => {
    const response = await route.fetch()
    const bytes = Buffer.from(await response.body())
    bytes[0] ^= 1
    await route.fulfill({ status: 200, contentType: 'application/gzip', body: bytes })
  })
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('checksum')
})

test('playback works when storage is unavailable', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage disabled') } })
  })
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })
  await expect(page.getByTestId('storage-note')).toContainText("Settings won't be remembered in this browser")
  expect(pageErrors).toEqual([])
})

test('playback resumes from a browser interruption', async ({ page }) => {
  test.setTimeout(60_000)
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()

  const status = page.getByTestId('engine-status')
  const position = page.getByTestId('position')
  await expect(status).toHaveText('playing', { timeout: 10_000 })
  const initialPosition = await position.textContent()
  await expect.poll(() => position.textContent(), { timeout: 5_000 }).not.toBe(initialPosition)

  await page.getByTestId('simulate-interruption').click()
  await expect(status).toHaveText('interrupted')
  await expect(page.getByTestId('audio-notice')).toContainText('Audio was interrupted by the browser. Press Play to resume.')
  const interruptedPosition = await position.textContent()
  await page.waitForTimeout(1_000)
  await expect(position).toHaveText(interruptedPosition ?? '')

  await page.getByTestId('play-toggle').click()
  await expect(status).toHaveText('playing')
  await expect(page.getByTestId('audio-notice')).toHaveCount(0)
  await expect.poll(() => position.textContent(), { timeout: 5_000 }).not.toBe(interruptedPosition)
  await expect.poll(async () => JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}').repeatEvents, { timeout: 2_000 }).toBe(1)
  expect(pageErrors).toEqual([])
})
