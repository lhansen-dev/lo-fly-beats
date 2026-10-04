import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const circuitPath = 'data/circuits/mbon-v1/circuit.json'
const circuitLimit = 200 * 1024
const totalLimit = 4 * 1024 * 1024

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesIn(path))
    else if (entry.isFile() && !entry.name.endsWith('.map')) files.push(path)
  }
  return files
}

try {
  const rows = []
  for (const path of await filesIn(dist)) {
    const bytes = await readFile(path)
    rows.push({ file: relative(dist, path).replaceAll('\\', '/'), bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length })
  }
  const circuit = rows.find(row => row.file === circuitPath)
  if (!circuit) throw new Error(`Missing ${circuitPath}; run npm run build first`)
  const total = rows.reduce((sum, row) => sum + row.gzipBytes, 0)
  console.table([...rows, { file: 'TOTAL (excluding source maps)', bytes: rows.reduce((sum, row) => sum + row.bytes, 0), gzipBytes: total }])
  console.log(`Circuit: ${circuit.gzipBytes} bytes / ${circuitLimit} bytes; total: ${total} bytes / ${totalLimit} bytes (gzip level 9)`)
  if (circuit.gzipBytes > circuitLimit || total > totalLimit) {
    console.error('Performance budget exceeded')
    process.exitCode = 1
  }
} catch (error) {
  console.error(`Budget measurement failed: ${error.message}`)
  process.exitCode = 1
}
