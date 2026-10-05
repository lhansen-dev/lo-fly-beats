import { expect, test } from '@playwright/test'
import { wholeConnectome } from '../helpers/wholeConnectome'
import { composePhrase } from '../../src/music/compose'
import { describeAnatomy, positionLabel, projectLocation } from '../../src/components/scanner/anatomy'

const graph = wholeConnectome()
const score = composePhrase(graph, { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 0, tempoBpm: 72 }, 0)

test('scanner follows the audible score, supports inspecting a beat, and clears on a new session', async ({ page }) => {
  // This exercises a full eight-bar phrase on the real audio clock, after loading the whole CNS.
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('network-overview')).toHaveAttribute('data-neurons', '165122')
  await expect(page.getByTestId('network-overview')).toHaveAttribute('data-positioned-neurons', '141000')
  await expect(page.locator('.anatomy-labels')).toContainText('CENTRAL BRAIN')
  await expect(page.locator('.anatomy-labels')).toContainText('VENTRAL')
  await expect(page.locator('.unlocated-label')).toContainText('24,122')
  await expect(page.locator('.scan-connections path')).toHaveCount(0)
  await expect(page.locator('.scan-dataset-stats')).toContainText('10,510,984')
  expect(await page.locator('[data-testid=network-scan] *').count()).toBeLessThan(100)
  await expect(page.getByTestId('scan-neuron-type')).toHaveText('Ready when you are')
  await expect(page.getByTestId('scan-beat-0')).toBeDisabled()
  await page.getByTestId('start-listening').click()
  const inspector = page.getByTestId('scan-inspector')
  await expect(inspector).toHaveAttribute('data-source', /\d+/)
  const firstBeat = await inspector.getAttribute('data-beat')
  await expect(inspector).not.toHaveAttribute('data-beat', firstBeat ?? '')
  await page.getByTestId('play-toggle').click()
  await expect(page.getByTestId('engine-status')).toHaveText('paused')
  const beat = Number(await inspector.getAttribute('data-beat'))
  const step = score.trace[beat]!
  expect(step.kind).toBe('edge')
  if (step.kind !== 'edge') throw new Error('Expected a real connection in the default score')
  await expect(inspector).toHaveAttribute('data-neuron-id', step.neuronId)
  await expect(inspector).toHaveAttribute('data-source', step.from)
  await expect(inspector).toHaveAttribute('data-synapses', String(step.synapseCount))
  await expect(page.getByTestId('scan-neuron-type')).toHaveText(step.neuronType!)
  for (const use of step.uses) await expect(inspector).toContainText(use)
  await expect(page.locator('.scan-node--current')).toHaveAttribute('data-neuron-id', step.neuronId)
  const selectedNeuron = graph.neurons.get(step.neuronId)!
  await expect(page.getByTestId('scan-region')).toHaveText(describeAnatomy(selectedNeuron).label)
  await expect(page.getByTestId('scan-position-kind')).toHaveText(positionLabel(selectedNeuron))
  const coordinates = selectedNeuron.anatomy?.somaLocation ?? selectedNeuron.anatomy?.tosomaLocation
  if (coordinates) {
    const point = projectLocation(coordinates)
    await expect(page.locator('.scan-node--current')).toHaveAttribute('cx', String(point.x))
    await expect(page.locator('.scan-node--current')).toHaveAttribute('cy', String(point.y))
  }
  await expect(page.locator('.fly-body-part--active').first()).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(inspector).toHaveAttribute('data-beat', String(beat))

  await page.getByTestId('scan-beat-0').click()
  await expect(inspector).toHaveAttribute('data-neuron-id', score.trace[0]!.neuronId!)
  await expect(inspector).toHaveAttribute('data-beat', '0')
  await expect(page.getByTestId('scan-region')).toHaveText(describeAnatomy(graph.neurons.get(score.trace[0]!.neuronId!)!).label)
  await expect(page.getByTestId('scan-follow')).toBeEnabled()
  await expect(page.getByTestId('scan-beat-31')).toBeDisabled()
  await page.getByTestId('scan-follow').click()
  await expect(inspector).toHaveAttribute('data-beat', String(beat))

  await page.getByTestId('scan-beat-0').click()
  await page.getByTestId('play-toggle').click()
  await page.getByTestId('tempo').press('End')
  await expect(page.getByTestId('position')).toContainText('Phrase 2', { timeout: 30_000 })
  await expect(page.getByTestId('scan-follow')).toBeDisabled()
  await expect(page.getByTestId('circuit-scanner')).toContainText('LIVE WALK')
  await page.getByTestId('play-toggle').click()
  await page.getByTestId('new-beat').click()
  await expect(page.getByTestId('scan-neuron-type')).toHaveText('Ready when you are')
  await expect(page.locator('.scan-node--current')).toHaveCount(0)
  await expect(page.locator('.fly-body-part--active')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('scanner honors reduced motion, the animation switch, and document visibility', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('network-overview')).toHaveAttribute('data-neurons', '165122')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
  const scanner = page.getByTestId('circuit-scanner')
  await expect(scanner).not.toHaveClass(/scanner--animated/)
  await page.getByTestId('animation-toggle').check()
  await expect(scanner).toHaveClass(/scanner--animated/)
  await page.getByTestId('animation-toggle').uncheck()
  await expect(scanner).not.toHaveClass(/scanner--animated/)
  await page.getByTestId('animation-toggle').check()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(scanner).not.toHaveClass(/scanner--animated/)
  await expect(page.getByTestId('engine-status')).toHaveText('playing')
})
