import { expect, test } from '@playwright/test'

test('the fly composes, critiques his phrase, accepts a banana, and remembers it after a reload', async ({ page }) => {
  test.setTimeout(120_000)
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons', { timeout: 60_000 })
  await expect(page.getByTestId('brain-status')).toContainText('awake', { timeout: 30_000 })
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('brain-status')).toContainText('playing what it just composed', { timeout: 30_000 })
  const bananas = Number(await page.getByTestId('phrase-bananas').textContent())
  expect(bananas).toBeGreaterThanOrEqual(0)
  expect(bananas).toBeLessThanOrEqual(10)
  await expect(page.getByTestId('brain-experience')).toContainText('Phrases played for you1')
  await page.getByTestId('give-banana').click()
  await expect(page.getByTestId('give-banana')).toBeDisabled()
  await expect(page.getByTestId('brain-experience')).toContainText('Bananas from you1')
  // Every fly-composed score carries brain provenance into the scanner's live label.
  await expect(page.getByTestId('circuit-scanner')).toContainText('LIVE BRAIN')
  await page.reload()
  await expect(page.getByTestId('brain-experience')).toContainText('Bananas from you1', { timeout: 60_000 })
  expect(pageErrors).toEqual([])
})

test('the classic connectome walk remains available', async ({ page }) => {
  await page.goto('/?composer=walk')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons', { timeout: 60_000 })
  await expect(page.getByTestId('fly-brain')).toHaveCount(0)
})
