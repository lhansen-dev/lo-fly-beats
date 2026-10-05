import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const circuitPaths = ['data/circuits/whole-cns-v1/neurons.json.gzip', 'data/circuits/whole-cns-v1/adjacency.bin.gzip']
const circuitLimit = 36 * 1024 * 1024
const totalLimit = 40 * 1024 * 1024

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
    rows.push({ file: relative(dist, path).replaceAll('\\', '/'), bytes: bytes.length, gzipBytes: path.endsWith('.gzip') ? bytes.length : gzipSync(bytes, { level: 9 }).length })
  }
  const circuitRows = circuitPaths.map(file => {
    const row = rows.find(row => row.file === file)
    if (!row) throw new Error(`Missing ${file}; run npm run build first`)
    return row
  })
  const circuitBytes = circuitRows.reduce((sum, row) => sum + row.gzipBytes, 0)
  const total = rows.reduce((sum, row) => sum + row.gzipBytes, 0)
  console.table([...rows, { file: 'TOTAL (excluding source maps)', bytes: rows.reduce((sum, row) => sum + row.bytes, 0), gzipBytes: total }])
  console.log(`Circuit: ${circuitBytes} bytes / ${circuitLimit} bytes; total: ${total} bytes / ${totalLimit} bytes (gzip level 9; .gzip assets counted as stored)`)
  if (circuitBytes > circuitLimit || total > totalLimit) {
    console.error('Performance budget exceeded')
    process.exitCode = 1
  }
} catch (error) {
  console.error(`Budget measurement failed: ${error.message}`)
  process.exitCode = 1
}
