import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const PREPRINT_DOI_URL = 'https://doi.org/10.1101/2025.10.09.680999'

test('credits include the circuit attribution and license links', async ({ page }) => {
  const manifest = JSON.parse(await readFile(resolve(process.cwd(), 'public/data/circuits/mbon-v1/manifest.json'), 'utf8'))
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))

  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')

  const credits = page.locator('#credits')
  await expect(credits.locator(`a[href="${manifest.license.url}"]`)).toHaveCount(1)
  expect(manifest.license.url).toBe('https://creativecommons.org/licenses/by/4.0/')
  await expect(credits.locator(`a[href="${PREPRINT_DOI_URL}"]`)).toHaveCount(1)

  const attribution = page.getByTestId('credits-attribution')
  await expect(attribution).toHaveText(manifest.license.attribution)
  expect(await attribution.textContent()).toBe(manifest.license.attribution)
  await expect(page.locator('footer a[href="#credits"]')).toHaveCount(1)
  expect(pageErrors).toEqual([])
})
