import { expect, test } from '@playwright/test'

test('pending changes apply at the next bar and the next phrase', async ({ page }) => {
  test.setTimeout(90_000)

  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))

  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await page.getByTestId('tempo').press('End')
  await expect(page.getByTestId('tempo')).toHaveValue('100')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })

  await page.getByTestId('variation').press('End')
  await expect(page.getByTestId('pending-changes')).toContainText('next phrase')
  await expect(page.getByTestId('pending-changes')).toHaveText('', { timeout: 21_000 })

  await page.getByTestId('tempo').press('Home')
  await expect(page.getByTestId('pending-changes')).toContainText('60 BPM at the next bar')
  await expect(page.getByTestId('pending-changes')).toHaveText('', { timeout: 3_000 })
  expect(pageErrors).toEqual([])
})
