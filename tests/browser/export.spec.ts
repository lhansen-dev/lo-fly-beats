import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { parseWavHeader } from '../../src/audio/wavInfo'
import { exportSeconds } from '../../src/audio/timing'

test.setTimeout(180_000)

test('exports a phrase and releases replaced object URLs', async ({ page }) => {
  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })
  await page.waitForTimeout(2000)
  await page.getByTestId('export-button').click()
  await expect(page.getByTestId('export-status')).toHaveText('ready', { timeout: 60_000 })
  await expect(page.getByTestId('engine-status')).toHaveText('paused')

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-download').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^lofly-rainy-windowsill-seed-[0-9a-f]{8}\.wav$/)
  const bytes = await readFile((await download.path())!)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const header = parseWavHeader(buffer)
  expect(header.channels).toBe(2)
  expect(header.sampleRate).toBe(44100)
  expect(header.bitsPerSample).toBe(16)
  expect(Math.abs(header.durationSeconds - exportSeconds(72))).toBeLessThan(0.01)
  expect(header.peak).toBeGreaterThan(1000)

  for (let i = 0; i < 2; i += 1) {
    await page.getByTestId('export-button').click()
    await expect(page.getByTestId('export-status')).toHaveText('ready', { timeout: 60_000 })
  }

  await expect.poll(async () => {
    const diagnostics = JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}')
    return diagnostics.objectUrlsHeld
  }).toBeLessThanOrEqual(1)
  await expect.poll(async () => {
    const diagnostics = JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}')
    return diagnostics.repeatEvents
  }).toBe(1)
  await page.getByTestId('play-toggle').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
})
