import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'Accessibility audit uses Chromium')
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
})

test('WCAG audit on first load, playing, expanded explanation and credits, and mobile', async ({ page }) => {
  const audit = async () => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
    await expect(page.getByRole('status')).toHaveCount(1)
  }
  await audit()
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await audit()
  await page.getByTestId('explanation').locator('summary').click()
  await expect(page.locator('#credits')).toBeVisible()
  await audit()
  await page.setViewportSize({ width: 390, height: 844 })
  await audit()
  await page.getByTestId('preset-fruit-bowl-finals').check()
  await expect(page.getByTestId('tempo')).toHaveAttribute('aria-valuetext', '86 BPM')
  await expect(page.locator('#tempo-pending')).toHaveText('86 BPM at the next phrase')
  await expect(page.getByTestId('tempo')).toHaveAttribute('aria-describedby', 'tempo-pending')
  await expect(page.getByTestId('variation')).toHaveAttribute('aria-valuetext', 'Variation 0 percent')
})

test('keyboard reaches every control with visible focus and starts audio', async ({ page }) => {
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur() })
  await page.keyboard.press('Tab')
  await expect(page.getByRole('img')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('start-listening')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await page.getByTestId('explanation').locator('summary').press('Enter')
  // Reverse from the final link, then traverse each native Tab stop in DOM order.
  await page.locator('footer a').focus()
  await page.keyboard.press('Tab')
  const visited: string[] = []
  for (let step = 0; step < 50; step += 1) {
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      const element = document.activeElement
      return element && element !== document.body
        ? { id: element.getAttribute('data-testid') ?? element.tagName, outline: getComputedStyle(element).outlineStyle }
        : null
    })
    if (!focus) break
    expect(focus.outline, focus.id).not.toBe('none')
    visited.push(focus.id)
  }
  for (const id of ['play-toggle', 'master-volume', 'layer-drums-level', 'layer-bass-level', 'layer-keys-level', 'layer-drums-mute', 'layer-bass-mute', 'layer-keys-mute', 'ambience-toggle', 'animation-toggle', 'tempo', 'variation', 'new-beat', 'export-button']) expect(visited).toContain(id)
})

test('shortcuts toggle only on the body or scene and keep announcements stable between beats', async ({ page }) => {
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('playback-status')).toHaveText('Playing')
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur() })
  await page.keyboard.press('Space')
  await expect(page.getByTestId('playback-status')).toHaveText('Paused')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('playback-status')).toHaveText('Playing')
  const position = await page.getByTestId('position').textContent()
  await expect(page.getByTestId('position')).not.toHaveText(position ?? '')
  await expect(page.getByTestId('playback-status')).toHaveText('Playing')
  await page.getByRole('img').focus()
  await page.keyboard.press('k')
  await expect(page.getByTestId('playback-status')).toHaveText('Paused')
  const seed = await page.getByTestId('seed-hex').textContent()
  await page.keyboard.press('n')
  await expect(page.getByTestId('seed-hex')).not.toHaveText(seed ?? '')
  const nextSeed = await page.getByTestId('seed-hex').textContent()
  for (const id of ['tempo', 'variation', 'master-volume', 'new-beat', 'preset-rainy-windowsill']) {
    await page.getByTestId(id).focus()
    await page.keyboard.press('k')
    await page.keyboard.press('n')
    await expect(page.getByTestId('engine-status')).toHaveText('paused')
    await expect(page.getByTestId('seed-hex')).toHaveText(nextSeed ?? '')
  }
})
