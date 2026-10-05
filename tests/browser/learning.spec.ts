import { expect, test, type Page } from '@playwright/test'

test.skip(process.env.LEARNING_BROWSER !== '1', 'The phase 4 experiment uses the development server; run npm run test:learning:browser.')
const ready = async (page: Page) => {
  await page.goto('/?learning=1&debug=1')
  await expect(page.getByTestId('learning-status')).toContainText('Learning score ready')
}
const diagnostics = async (page: Page) => JSON.parse(await page.getByTestId('diagnostics').innerText()) as {
  repeatEvents: number; scoresHeld: number
  learning: { workers: number; readyScores: number; fallbackCount: number; pendingPreparations: number; recentActions: number; recentMotifs: number; preparationsMeasured: number; preparationMs: number; p95PreparationMs: number }
}
const checkpoint = (page: Page) => page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('lofly-learning-v1', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction('checkpoints').objectStore('checkpoints').get('current')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
})

test('teaches during playback, defers while paused, restores the boundary, and exports frozen learning', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: Error[] = []
  page.on('pageerror', error => errors.push(error))
  await ready(page)
  await page.getByTestId('tempo').press('End')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('export-button')).toBeEnabled()
  await page.getByRole('button', { name: 'Teach motif', exact: true }).click()
  await expect(page.getByTestId('learning-status')).toContainText('ready for the next phrase boundary', { timeout: 15_000 })
  await page.getByTestId('play-toggle').click()
  await expect(page.getByTestId('engine-status')).toHaveText('paused')
  await expect(page.getByTestId('learning-counters')).toContainText('Model revision: 0')
  await page.waitForTimeout(300)
  await expect(page.getByTestId('learning-counters')).toContainText('Accepted training updates: 0')
  await page.getByTestId('play-toggle').click()
  await expect(page.getByTestId('learning-counters')).toContainText('Model revision: 1', { timeout: 23_000 })
  await expect(page.getByTestId('learning-counters')).toContainText('Accepted training updates: 20000')
  await expect(page.getByTestId('learning-checkpoint')).toContainText('boundary saved')
  await page.getByTestId('play-toggle').click()
  const decisions = await page.getByRole('list', { name: 'Reservoir decoder bass decisions' }).innerText()
  const saved = await checkpoint(page)
  await page.reload()
  await expect(page.getByTestId('learning-checkpoint')).toContainText('Restored the current checkpoint; playback is paused')
  await expect(page.getByTestId('engine-status')).toHaveText('idle')
  await expect(page.getByTestId('learning-counters')).toContainText('Model revision: 1')
  await page.getByTestId('start-listening').click()
  await expect(page.getByRole('list', { name: 'Reservoir decoder bass decisions' })).toHaveText(decisions, { useInnerText: true })
  await expect(page.getByTestId('learning-checkpoint')).toContainText('boundary saved')
  expect(await checkpoint(page)).toEqual(saved)
  await page.getByTestId('play-toggle').click()
  const counters = await page.getByTestId('learning-counters').innerText()
  await page.getByTestId('export-button').click()
  await expect(page.getByTestId('export-download')).toBeVisible({ timeout: 25_000 })
  await expect(page.getByTestId('engine-status')).toHaveText('paused')
  await expect(page.getByTestId('learning-counters')).toHaveText(counters)
  expect(await checkpoint(page)).toEqual(saved)
  const d = await diagnostics(page)
  expect(d.repeatEvents).toBe(1)
  expect(d.scoresHeld).toBeLessThanOrEqual(2)
  expect(d.learning).toMatchObject({ workers: 1, fallbackCount: 0 })
  expect(d.learning.recentActions).toBeLessThanOrEqual(8)
  expect(d.learning.recentMotifs).toBeLessThanOrEqual(8)
  expect(errors).toEqual([])
})

test('recovers a previous checkpoint, then initializes fresh when both are corrupt', async ({ page }) => {
  test.setTimeout(60_000)
  await ready(page)
  await page.getByRole('button', { name: 'Teach motif', exact: true }).click()
  await expect(page.getByTestId('learning-counters')).toContainText('Model revision: 1')
  await expect(page.getByTestId('learning-checkpoint')).toContainText('boundary saved')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('export-button')).toBeEnabled()
  await expect(page.getByTestId('learning-checkpoint')).toContainText('boundary saved')
  const corrupt = async (both: boolean) => page.evaluate(async both => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('lofly-learning-v1', 1)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('checkpoints', 'readwrite')
      transaction.objectStore('checkpoints').put({ malformed: true }, 'current')
      if (both) transaction.objectStore('checkpoints').put({ incompatible: true }, 'previous')
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
    })
    db.close()
  }, both)
  await corrupt(false)
  await page.reload()
  await expect(page.getByTestId('learning-checkpoint')).toContainText('previous compatible checkpoint')
  await expect(page.getByTestId('learning-counters')).toContainText('Model revision: 1')
  await corrupt(true)
  await page.reload()
  await expect(page.getByTestId('learning-checkpoint')).toContainText('initialized a fresh fly')
  await expect(page.getByTestId('learning-counters')).toContainText('Model revision: 0')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
})

test('unavailable storage leaves the in-memory learning player usable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(globalThis, 'indexedDB', { get() { throw new Error('storage denied') } }))
  await ready(page)
  await expect(page.getByTestId('learning-checkpoint')).toContainText('storage unavailable')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await expect(page.getByTestId('learning-checkpoint')).toContainText('save failed')
  await page.getByTestId('play-toggle').click()
  await expect(page.getByTestId('engine-status')).toHaveText('paused')
})

test('a late worker reply repeats a score and retries from the frozen boundary', async ({ page }) => {
  test.setTimeout(75_000)
  await page.addInitScript(() => {
    const NativeWorker = globalThis.Worker
    globalThis.Worker = class extends NativeWorker {
      private preparations = 0
      override postMessage(message: { type?: string }, options?: StructuredSerializeOptions | Transferable[]): void {
        const send = () => {
          if (Array.isArray(options)) super.postMessage(message, options)
          else super.postMessage(message, options)
        }
        if (message.type === 'prepare' && ++this.preparations === 2) {
          setTimeout(send, 22_000)
        } else send()
      }
    }
  })
  await ready(page)
  await page.getByTestId('tempo').press('End')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('export-button')).toBeEnabled()
  const decisions = await page.getByRole('list', { name: 'Reservoir decoder bass decisions' }).innerText()
  const saved = await checkpoint(page)
  await expect.poll(async () => (await diagnostics(page)).learning.fallbackCount, { timeout: 23_000 }).toBe(1)
  await expect(page.getByRole('list', { name: 'Reservoir decoder bass decisions' })).toHaveText(decisions, { useInnerText: true })
  expect(await checkpoint(page)).toEqual(saved)
  await expect.poll(async () => (await diagnostics(page)).learning.readyScores, { timeout: 8_000 }).toBe(2)
  await expect(page.getByTestId('position')).toContainText('Phrase 3', { timeout: 23_000 })
  const next = await checkpoint(page) as { phraseIndex: number; snapshot: { runtime: { generationIndex: number } } }
  expect(next.phraseIndex).toBe(2)
  expect(next.snapshot.runtime.generationIndex).toBe(0)
  expect((await diagnostics(page)).repeatEvents).toBe(1)
})


test('measures preparation latency and keeps reset/variation forecasts bounded', async ({ page }) => {
  test.setTimeout(90_000)
  await ready(page)
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('export-button')).toBeEnabled()
  await page.getByTestId('play-toggle').click()
  const baseline = await checkpoint(page)
  const slider = page.getByTestId('variation')
  for (let index = 0; index < 32; index++) {
    const measured = (await diagnostics(page)).learning.preparationsMeasured
    await slider.press('ArrowRight')
    await expect.poll(async () => (await diagnostics(page)).learning.preparationsMeasured).toBeGreaterThan(measured)
  }
  const d = await diagnostics(page)
  console.log('Learning preparation measurement:', JSON.stringify(d.learning))
  // Recorded phase 4 adjustment for Chromium headless SwiftShader animation.
  // The original 100 ms target remains enforced below with scene motion disabled.
  expect(d.learning.p95PreparationMs).toBeLessThan(200)
  await page.getByRole('checkbox', { name: 'Animate scene' }).uncheck()
  const stillTimings: number[] = []
  for (let index = 0; index < 32; index++) {
    const measured = (await diagnostics(page)).learning.preparationsMeasured
    await slider.press('ArrowLeft')
    await expect.poll(async () => (await diagnostics(page)).learning.preparationsMeasured).toBeGreaterThan(measured)
    stillTimings.push((await diagnostics(page)).learning.preparationMs)
  }
  const p95Still = stillTimings.sort((a, b) => a - b)[Math.ceil(0.95 * stillTimings.length) - 1]!
  console.log('Learning preparation with animation disabled, p95 ms:', p95Still)
  expect(p95Still).toBeLessThan(100)
  expect(d.learning.readyScores).toBe(2)
  expect(d.learning.workers).toBe(1)
  expect(d.learning.pendingPreparations).toBe(0)
  expect(await checkpoint(page)).toEqual(baseline)
  await page.getByRole('radio', { name: /Overripe at 2 AM/ }).check()
  await expect(page.getByTestId('pending-changes')).toHaveText('')
  await page.getByTestId('new-beat').click()
  await expect(page.getByTestId('learning-status')).toContainText('Learning score ready')
  await page.getByTestId('play-toggle').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  await expect(page.getByTestId('export-button')).toBeEnabled()
  expect((await diagnostics(page)).repeatEvents).toBe(1)
})
