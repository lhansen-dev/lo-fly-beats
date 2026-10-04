import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const prefix = '/nested/lofly/'
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404).end('Not found')
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed')
      return
    }
    const path = resolve(root, pathname.slice(prefix.length) || 'index.html')
    if (!path.startsWith(resolve(root) + sep)) {
      response.writeHead(403).end('Forbidden')
      return
    }
    const bytes = await readFile(path)
    response.writeHead(200, { 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream', 'Content-Length': bytes.length })
    response.end(request.method === 'HEAD' ? undefined : bytes)
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400).end('Not found')
  }
})

server.on('error', error => { console.error(error.message); process.exitCode = 1 })
server.listen(4174, 'localhost', () => console.log('Serving dist at http://localhost:4174/nested/lofly/'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections() })
