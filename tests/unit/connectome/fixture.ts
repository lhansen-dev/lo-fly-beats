import { readFileSync } from 'node:fs'
import { circuitSchema, manifestSchema } from '../../../src/connectome/schema'

const directory = new URL('../../fixtures/graphs/branching/', import.meta.url)

export function fixture() {
  const bytes = readFileSync(new URL('circuit.json', directory))
  const circuit = circuitSchema.parse(JSON.parse(bytes.toString('utf8')))
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')))
  return { circuit, manifest, bytes }
}
