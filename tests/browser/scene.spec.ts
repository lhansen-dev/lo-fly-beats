import { expect, test } from '@playwright/test'

const presets = ['rainy-windowsill', 'overripe-2am', 'fruit-bowl-finals'] as const
const sizes = [{ width: 1280, height: 720 }, { width: 390, height: 844 }]

for (const { width, height } of sizes) {
  test(`3D scene accessibility at ${width}x${height}`, async ({ page }) => {
    const errors: Error[] = []
    page.on('pageerror', error => errors.push(error))
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const scene = page.getByTestId('scene-frame').getByRole('img')
    await expect(scene).toHaveAccessibleName('A fruit fly studying beside a banana')
    await expect(scene).toHaveAttribute('aria-labelledby', 'scene-title')
    await expect(scene).toHaveAttribute('aria-describedby', 'scene-desc')
    await expect(scene.locator('#scene-desc')).toContainText('six jointed legs')
    await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-renderer', 'webgl')
    await expect(page.getByTestId('scene-canvas')).toHaveAttribute('aria-hidden', 'true')
    expect(errors).toEqual([])
  })
}

for (const preset of presets) {
  for (const { width, height } of sizes) {
    test(`3D scene ${preset} at ${width}x${height}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto('/')
      await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
      const canvas = page.getByTestId('scene-canvas')
      await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
      await page.getByTestId(`preset-${preset}`).check()
      await expect(canvas).toHaveAttribute('data-preset', preset)
      await page.setViewportSize({ width, height })
      await testInfo.attach(`scene-${preset}-${width}x${height}`, {
        body: await page.getByTestId('scene-frame').screenshot(), contentType: 'image/png',
      })
    })
  }
}

test('changing presets repaints the 3D scene while animation is disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  const canvas = page.getByTestId('scene-canvas')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  const initial = await canvas.screenshot()
  await page.getByTestId('preset-overripe-2am').check()
  await expect(canvas).toHaveAttribute('data-preset', 'overripe-2am')
  expect(await canvas.screenshot()).not.toEqual(initial)
  await expect(canvas).toHaveAttribute('data-motion', 'still')
})

test('WebGL failure leaves an accessible still image and working audio', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      if (String(args[0]).startsWith('webgl')) return null
      return getContext.apply(this, args)
    } as typeof getContext
  })
  await page.goto('/')
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-renderer', 'fallback')
  await expect(page.getByTestId('scene-frame').getByRole('img')).toBeVisible()
  const fallback = await page.request.get('/images/listening-room.jpg')
  expect(fallback.ok()).toBe(true)
  expect(fallback.headers()['content-type']).toContain('image/jpeg')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })
})

test('WebGL context loss and restoration preserve the scene and playback', async ({ page }) => {
  await page.goto('/')
  const canvas = page.getByTestId('scene-canvas')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await canvas.evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')!
    const extension = gl.getExtension('WEBGL_lose_context')!
    extension.loseContext()
    setTimeout(() => extension.restoreContext(), 750)
  })
  await expect(canvas).toHaveAttribute('data-renderer', 'fallback')
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl')
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
})
