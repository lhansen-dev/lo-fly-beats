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

test('scene contains one fly placeholder and one banana', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  const svg = page.getByTestId('scene-frame').locator('svg.scene')
  await expect(svg.locator('.fly')).toHaveCount(1)
  await expect(svg.locator('.banana')).toHaveCount(1)
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
