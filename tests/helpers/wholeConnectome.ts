import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { buildCompactGraph } from '../../src/connectome/compact'
import { manifestSchema } from '../../src/connectome/schema'

export const wholeDirectory = new URL('../../public/data/circuits/whole-cns-v1/', import.meta.url)
export const wholeManifest = manifestSchema.parse(JSON.parse(readFileSync(new URL('manifest.json', wholeDirectory), 'utf8')))

export function wholeConnectome() {
  if (wholeManifest.output.file !== 'neurons.json.gzip') throw new Error('Expected compact data')
  const decompress = (spec: { file: string; bytes: number; sha256: string }) => {
    const compressed = readFileSync(new URL(spec.file, wholeDirectory))
    if (compressed.length !== spec.bytes || createHash('sha256').update(compressed).digest('hex') !== spec.sha256) throw new Error(`Invalid ${spec.file}`)
    return gunzipSync(compressed)
  }
  const neurons = JSON.parse(decompress(wholeManifest.output).toString('utf8'))
  const adjacency = decompress(wholeManifest.output.adjacency)
  const bytes = adjacency.buffer.slice(adjacency.byteOffset, adjacency.byteOffset + adjacency.byteLength) as ArrayBuffer
  return buildCompactGraph(wholeManifest, neurons, bytes)
}
