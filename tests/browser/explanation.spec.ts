import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

test('explains a recent real connection from the circuit', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', error => pageErrors.push(error))
  const circuit = JSON.parse(await readFile(resolve(process.cwd(), 'public/data/circuits/mbon-v1/circuit.json'), 'utf8'))

  await page.goto('/')
  await expect(page.getByTestId('circuit-status')).toContainText('97 neurons')
  await page.getByTestId('start-listening').click()
  await expect(page.getByTestId('engine-status')).toHaveText('playing', { timeout: 10_000 })
  await page.getByTestId('explanation').locator('summary').click()

  let result: { source: string; target: string; synapses: string } | null = null
  await expect.poll(async () => {
    result = await page.evaluate(() => {
      const item = [...document.querySelectorAll<HTMLElement>('[data-testid="explanation"] li[data-source]')]
        .find(element => element.textContent?.includes('Real connection'))
      if (!item) return null
      const { source, target, synapses } = item.dataset
      return source === undefined || target === undefined || synapses === undefined ? null : { source, target, synapses }
    })
    return result
  }, { timeout: 8_000 }).not.toBeNull()
  const { source, target, synapses } = result!
  expect(circuit.connections).toContainEqual(expect.objectContaining({ source, target, synapseCount: Number(synapses) }))
  expect(circuit.neurons.some((neuron: { id: string | number }) => String(neuron.id) === source)).toBe(true)
  expect(circuit.neurons.some((neuron: { id: string | number }) => String(neuron.id) === target)).toBe(true)
  expect(pageErrors).toEqual([])
})
