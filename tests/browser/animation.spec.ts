import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function sceneCounter(page: Page, name = 'data-frame-count'): Promise<number> {
  return Number(await page.getByTestId('scene-canvas').getAttribute(name) ?? 0)
}

async function start(page: Page): Promise<void> {
  await page.goto('/?debug=1')
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-renderer', 'webgl')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })
}

test('reduced motion stops WebGL frames and musical cues until explicitly enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page)
  const canvas = page.getByTestId('scene-canvas')
  await expect(canvas).toHaveAttribute('data-motion', 'still')
  await page.waitForTimeout(300)
  const before = await sceneCounter(page)
  await page.waitForTimeout(2100)
  expect(await sceneCounter(page)).toBe(before)
  expect(await sceneCounter(page, 'data-bob-count')).toBe(0)
  await expect(page.getByRole('img')).toHaveClass(/scene--still/)
  const toggle = page.getByTestId('animation-toggle')
  await expect(toggle).not.toBeChecked()
  await toggle.check()
  await expect(canvas).toHaveAttribute('data-motion', 'running')
  await expect.poll(() => sceneCounter(page)).toBeGreaterThan(before)
  await expect.poll(() => sceneCounter(page, 'data-bob-count')).toBeGreaterThan(0)
  await page.waitForTimeout(700)
  await page.reload()
  await expect(toggle).toBeChecked()
  await expect(canvas).toHaveAttribute('data-motion', 'running')
})

test('the 3D fly receives head bobs on musical beats', async ({ page }) => {
  const errors: Error[] = []
  page.on('pageerror', error => errors.push(error))
  await start(page)
  await expect.poll(() => sceneCounter(page, 'data-bob-count'), { timeout: 3000 }).toBeGreaterThan(0)
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-motion', 'running')
  expect(errors).toEqual([])
})

test('the animation switch stops and resumes WebGL rendering during playback', async ({ page }) => {
  await start(page)
  const canvas = page.getByTestId('scene-canvas')
  const toggle = page.getByTestId('animation-toggle')
  await toggle.uncheck()
  await expect(canvas).toHaveAttribute('data-motion', 'still')
  const before = await sceneCounter(page)
  const bobs = await sceneCounter(page, 'data-bob-count')
  await page.waitForTimeout(1300)
  expect(await sceneCounter(page)).toBe(before)
  expect(await sceneCounter(page, 'data-bob-count')).toBe(bobs)
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await toggle.check()
  await expect.poll(() => sceneCounter(page)).toBeGreaterThan(before)
})

test('hidden documents stop GPU frames and cue timers while audio keeps playing', async ({ page }) => {
  await start(page)
  const canvas = page.getByTestId('scene-canvas')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByRole('img')).toHaveClass(/scene--paused/)
  await expect(canvas).toHaveAttribute('data-motion', 'paused')
  const before = await sceneCounter(page)
  const bobs = await sceneCounter(page, 'data-bob-count')
  await page.waitForTimeout(2000)
  expect(await sceneCounter(page)).toBe(before)
  expect(await sceneCounter(page, 'data-bob-count')).toBe(bobs)
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => sceneCounter(page)).toBeGreaterThan(before)
  await expect.poll(() => sceneCounter(page, 'data-bob-count')).toBeGreaterThan(bobs)
})
