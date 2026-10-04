import { expect, test } from '@playwright/test'

const layers = ['drums', 'bass', 'keys']

test('mixer controls remain live during playback', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  for (const id of [...layers.map(x => `layer-${x}-level`), ...layers.map(x => `layer-${x}-mute`), 'ambience-toggle']) await expect(page.getByTestId(id)).toBeEnabled()
  await page.getByTestId('start-listening').click()
  const requirePlaying = async () => {
    await expect(page.getByTestId('engine-status')).toHaveText('playing')
    await expect.poll(async () => JSON.parse((await page.getByTestId('diagnostics').textContent()) ?? '{}')).toMatchObject({ status: 'playing', repeatEvents: 1 })
  }
  await requirePlaying()
  for (const id of [...layers.map(x => `layer-${x}-mute`), 'ambience-toggle']) {
    await page.getByTestId(id).uncheck(); await requirePlaying()
    await page.getByTestId(id).check(); await requirePlaying()
  }
  for (const id of ['master-volume', ...layers.map(x => `layer-${x}-level` )]) {
    await page.getByTestId(id).press('Home'); await requirePlaying()
    await page.getByTestId(id).press('End'); await requirePlaying()
  }
  expect(errors).toEqual([])
})

test('complete mixer settings persist and restore', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await page.getByTestId('master-volume').press('Home')
  await page.getByTestId('layer-drums-level').press('End')
  await page.getByTestId('layer-bass-level').press('Home')
  await page.getByTestId('layer-keys-level').press('End')
  for (const id of layers.map(x => `layer-${x}-mute`)) await page.getByTestId(id).check()
  await page.getByTestId('ambience-toggle').uncheck()
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('lofly:settings:v1') ?? '{}').mix)).toEqual({ masterVolume: 0, layers: { drums: { level: 1, muted: true }, bass: { level: 0, muted: true }, keys: { level: 1, muted: true } }, ambienceOn: false })
  await page.reload()
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await expect(page.getByTestId('master-volume')).toHaveValue('0')
  await expect(page.getByTestId('layer-drums-level')).toHaveValue('100')
  await expect(page.getByTestId('layer-bass-level')).toHaveValue('0')
  await expect(page.getByTestId('layer-keys-level')).toHaveValue('100')
  for (const id of layers.map(x => `layer-${x}-mute`)) await expect(page.getByTestId(id)).toBeChecked()
  await expect(page.getByTestId('ambience-toggle')).not.toBeChecked()
  await expect(page.getByTestId('engine-status')).toHaveText('idle')
  await expect(page.getByTestId('position')).toHaveText('Phrase 1 · Bar 1 · Beat 1')
})
