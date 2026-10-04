import { expect, test } from '@playwright/test'

const presets = ['rainy-windowsill', 'overripe-2am', 'fruit-bowl-finals'] as const
const sizes = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]

for (const { width, height } of sizes) {
  test(`scene accessibility at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
    const svg = page.getByTestId('scene-frame').locator('svg.scene')
    await expect(svg).toHaveAttribute('aria-labelledby', 'scene-title scene-desc')
    await expect(svg.locator('#scene-title')).toHaveText('A fruit fly studying beside a banana')
    await expect(svg.locator('#scene-desc')).not.toBeEmpty()
  })
}

test('scene contains one fly and one banana', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  const svg = page.getByTestId('scene-frame').locator('svg.scene')
  await expect(svg.locator('.fly')).toHaveCount(1)
  await expect(svg.locator('.banana')).toHaveCount(1)
})

test('scene contains all fly features exactly once', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  const svg = page.getByTestId('scene-frame').locator('svg.scene')
  for (const name of ['fly', 'fly-body', 'fly-wings', 'fly-head', 'fly-eye-shine', 'fly-headphones', 'fly-hands-front']) {
    await expect(svg.locator(`.${name}`)).toHaveCount(1)
  }
})

test('fly stays within the scene bounds', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  const svg = page.getByTestId('scene-frame').locator('svg.scene')
  const box = await svg.locator('.fly').evaluate((el) => {
    const b = (el as SVGGraphicsElement).getBBox()
    return { x: b.x, y: b.y, width: b.width, height: b.height }
  })
  expect(box.x).toBeGreaterThanOrEqual(800)
  expect(box.y).toBeGreaterThanOrEqual(230)
  expect(box.x + box.width).toBeLessThanOrEqual(1280)
  expect(box.y + box.height).toBeLessThanOrEqual(740)
})

test('changing preset while paused changes the wall fill', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  const fill = () => page.evaluate(() => getComputedStyle(document.querySelector('.wall-base')!).fill)
  const initialFill = await fill()
  expect(initialFill).toBe('rgb(59, 74, 90)')
  await page.getByTestId('preset-overripe-2am').check()
  await expect.poll(fill).toBe('rgb(42, 35, 32)')
  expect(await fill()).not.toBe(initialFill)
})

test.describe('fly close-ups', () => {
  test.use({ deviceScaleFactor: 2 })

  for (const preset of presets) {
    test(`fly close-up ${preset}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto('/')
      await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
      await page.getByTestId(`preset-${preset}`).check()
      await expect(page.locator('main.app')).toHaveAttribute('data-preset', preset)
      const svg = page.getByTestId('scene-frame').locator('svg.scene')
      const body = await svg.locator('.fly').screenshot()
      await testInfo.attach(`fly-closeup-${preset}`, { body, contentType: 'image/png' })
    })
  }
})

for (const preset of presets) {
  for (const { width, height } of sizes) {
    test(`scene ${preset} screenshot at ${width}x${height}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto('/')
      await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
      await page.getByTestId(`preset-${preset}`).check()
      await expect(page.locator('main.app')).toHaveAttribute('data-preset', preset)
      await page.setViewportSize({ width, height })
      await testInfo.attach(`scene-${preset}-${width}x${height}`, {
        body: await page.getByTestId('scene-frame').screenshot(),
        contentType: 'image/png',
      })
    })
  }
}

test('serialized scene markup is under 150 KB', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  const svg = page.getByTestId('scene-frame').locator('svg.scene')
  const length = await svg.evaluate(el => new XMLSerializer().serializeToString(el).length)
  expect(length).toBeLessThan(150 * 1024)
})
