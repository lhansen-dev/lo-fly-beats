import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { parseWavHeader } from '../../src/audio/wavInfo'

test('plays a real traversal and exports a stereo WAV', async ({ page, browser }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await expect(page.getByTestId('audio-state')).toHaveText('inactive')
  await expect(page.getByRole('table', { name: 'Spike traversal' }).locator('tbody tr')).toHaveCount(8)
  await page.getByRole('button', { name: 'Play spike', exact: true }).click()
  await expect(page.getByTestId('audio-state')).toHaveText('running', { timeout: 5000 })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Stop spike', exact: true }).click()
  await page.getByRole('button', { name: 'Render spike WAV', exact: true }).click()
  const downloadLink = page.getByTestId('spike-download')
  await expect(downloadLink).toBeVisible()
  const downloadEvent = page.waitForEvent('download')
  await downloadLink.click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('lofly-spike.wav')
  const path = await download.path()
  if (!path) throw new Error('WAV download has no local path')
  const bytes = await readFile(path)
  const info = parseWavHeader(new Uint8Array(bytes).buffer)
  expect(info.channels).toBe(2)
  expect(info.sampleRate).toBe(44100)
  expect(info.bitsPerSample).toBe(16)
  expect(Math.abs(info.durationSeconds - 3)).toBeLessThan(0.01)
  expect(info.peak).toBeGreaterThan(1000)
  // Offline rendering must leave the live engine usable.
  await page.getByRole('button', { name: 'Play spike', exact: true }).click()
  await expect(page.getByTestId('audio-state')).toHaveText('running')
  await page.getByRole('button', { name: 'Stop spike', exact: true }).click()
  expect(errors).toEqual([])
  const result = { browser: testInfo.project.name, version: browser.version(), ...info }
  await testInfo.attach('spike-result', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  console.log(JSON.stringify(result))
})
