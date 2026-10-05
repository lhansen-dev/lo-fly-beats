import { expect, test } from '@playwright/test'

test('playback and the first beat position start within two seconds', async ({ page, browser }) => {
  test.skip(test.info().project.name !== 'chromium', 'Startup budget targets Chromium')
  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('165122 neurons')
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="start-listening"]')!
    const status = document.querySelector('[data-testid="engine-status"]')!
    const position = document.querySelector('[data-testid="position"]')!
    const initial = position.textContent
    const tracked = window as typeof window & { startupTimings: { started: number; playingMs?: number; positionMs?: number } }
    button.addEventListener('click', () => { tracked.startupTimings = { started: performance.now() } }, { once: true })
    const observer = new MutationObserver(() => {
      const timing = tracked.startupTimings
      if (!timing) return
      if (status.textContent === 'playing' && timing.playingMs === undefined) timing.playingMs = performance.now() - timing.started
      if (position.textContent !== initial && timing.positionMs === undefined) timing.positionMs = performance.now() - timing.started
      if (timing.playingMs !== undefined && timing.positionMs !== undefined) observer.disconnect()
    })
    observer.observe(status, { subtree: true, childList: true, characterData: true })
    observer.observe(position, { subtree: true, childList: true, characterData: true })
  })
  await page.getByTestId('start-listening').click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { startupTimings: { positionMs?: number } }).startupTimings.positionMs)).toBeGreaterThan(0)
  const timing = await page.evaluate(() => (window as typeof window & { startupTimings: { playingMs?: number; positionMs?: number } }).startupTimings)
  expect(timing.playingMs).toBeLessThan(2000)
  expect(timing.positionMs).toBeLessThan(2000)
  console.log(`Startup (${browser.version()}): playing ${timing.playingMs?.toFixed(1)} ms; first position ${timing.positionMs?.toFixed(1)} ms`)
})
