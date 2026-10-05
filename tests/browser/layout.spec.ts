import { expect, test } from '@playwright/test'

const sizes = [
  { width: 1280, height: 800 },
  { width: 800, height: 900 },
  { width: 390, height: 844 },
]

for (const { width, height } of sizes) {
  test(`layout at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
    await expect(page.getByTestId('scene-frame')).toBeVisible()

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    await expect(page.getByTestId('scene-frame')).toHaveCSS('aspect-ratio', width >= 700 ? '16 / 9' : '4 / 3')
    await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-renderer', 'webgl')
    await expect(page.locator('main.app')).toHaveAttribute('data-preset', 'rainy-windowsill')
    await testInfo.attach(`layout-${width}x${height}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
  })
}

test('no horizontal scroll at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
})

test('sticky bottom bar keeps play and volume on screen at 390x844', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2))
  await expect(page.getByTestId('play-toggle')).toBeInViewport()
  await expect(page.getByTestId('master-volume')).toBeInViewport()
})
