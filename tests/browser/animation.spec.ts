import { expect, test } from '@playwright/test'

async function installAnimationRecorder(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate
    Object.defineProperty(window, '__animateCalls', { configurable: true, value: [] as string[] })
    Element.prototype.animate = function (...args: Parameters<typeof animate>) {
      ;(window as typeof window & { __animateCalls: string[] }).__animateCalls.push(this.getAttribute('class') ?? '')
      return animate.apply(this, args)
    }
  })
}

async function runningSceneAnimations(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const scene = document.querySelector('svg.scene')
    if (!scene) return 0
    return document.getAnimations().filter(animation => {
      const target = (animation.effect as KeyframeEffect | null)?.target
      return animation.playState === 'running' && target instanceof Node && scene.contains(target)
    }).length
  })
}

test('reduced motion keeps the scene still until animation is enabled', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installAnimationRecorder(page)
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })

  for (let sample = 0; sample < 5; sample += 1) {
    expect(await runningSceneAnimations(page)).toBe(0)
    await page.waitForTimeout(500)
  }
  expect(await page.evaluate(() => (window as typeof window & { __animateCalls: string[] }).__animateCalls.filter(name => name.startsWith('fly-')))).toEqual([])
  await expect(page.locator('svg.scene')).toHaveClass(/scene--still/)
  const toggle = page.getByTestId('animation-toggle')
  await expect(toggle).not.toBeChecked()
  await toggle.check()
  await expect.poll(() => runningSceneAnimations(page)).toBeGreaterThan(0)
  await expect(page.locator('svg.scene')).not.toHaveClass(/scene--still/)
  await page.waitForTimeout(700)
  await page.reload()
  await expect(toggle).toBeChecked()
  expect(pageErrors).toEqual([])
})

test('default motion animates the scene during playback', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  await installAnimationRecorder(page)
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __animateCalls: string[] }).__animateCalls.includes('fly-head')), { timeout: 3_000 }).toBe(true)
  expect(pageErrors).toEqual([])
})

test('hidden document pauses scene animation without stopping playback', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  await installAnimationRecorder(page)
  await page.goto('/?debug=1')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('svg.scene')).toHaveClass(/scene--paused/)
  const diagnostics = page.getByTestId('diagnostics')
  await expect.poll(async () => JSON.parse((await diagnostics.textContent()) ?? '{}').status).toBe('playing')
  const countFlyHead = () => page.evaluate(() => (window as typeof window & { __animateCalls: string[] }).__animateCalls.filter(name => name === 'fly-head').length)
  const before = await countFlyHead()
  await page.waitForTimeout(2_000)
  expect(await countFlyHead()).toBe(before)
  expect(pageErrors).toEqual([])
})
