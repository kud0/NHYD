import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'

const PORT = 8765 // Use different port to avoid conflicts
const STORAGE = path.join(process.cwd(), '..', 'storage')

console.log(`\n📁 File Server`)
console.log(`Port: ${PORT}`)
console.log(`Storage: ${STORAGE}\n`)

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || '', true)
  const pathname = decodeURIComponent(parsed.pathname || '/').substring(1)

  if (!pathname) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ClassMind File Server\n')
    return
  }

  const filePath = path.join(STORAGE, pathname)

  // Security: prevent path traversal
  if (!filePath.startsWith(STORAGE)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // Check file exists
  if (!fs.existsSync(filePath)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    res.writeHead(400)
    res.end('Not a file')
    return
  }

  // Stream file
  const mimeTypes: { [k: string]: string } = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.jpg': 'image/jpeg',
    '.png': 'image/png'
  }
  const ext = path.extname(filePath)
  const mime = mimeTypes[ext] || 'application/octet-stream'

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes'
  })

  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`)
  console.log(`Audio files: http://localhost:${PORT}/01-Biomecánica/...`)
})
