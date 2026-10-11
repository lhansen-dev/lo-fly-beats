import { readFile } from 'node:fs/promises'
import { decodeBrainCircuit } from '../../src/brain/circuit'

/** Load the committed song circuit from disk with the same checksum verification as the browser. */
export async function loadBrainFromDisk() {
  const root = new URL('../../public/data/circuits/song-v1/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8')) as unknown
  const compressed = new Uint8Array(await readFile(new URL('brain.json.gzip', root)))
  return decodeBrainCircuit(manifest, compressed)
}
