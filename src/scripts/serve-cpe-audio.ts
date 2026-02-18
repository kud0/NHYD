import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'

const PORT = 3001
const STORAGE_PATH = path.join(process.cwd(), 'storage')

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url || '', true)
  let pathname = decodeURIComponent(parsedUrl.pathname || '/')

  // Handle root path
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', message: 'CPE Audio Server', port: PORT }))
    return
  }

  // Serve files from /storage path
  if (pathname.startsWith('/storage/')) {
    const filePath = path.join(STORAGE_PATH, pathname.substring(9)) // Remove '/storage/' prefix

    // Security: prevent path traversal
    if (!filePath.startsWith(STORAGE_PATH)) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Access denied' }))
      return
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'File not found: ' + filePath }))
      return
    }

    // Check if it's a directory
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Cannot serve directory' }))
      return
    }

    // Serve the file
    const fileSize = stat.size
    const mimeTypes: { [key: string]: string } = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.json': 'application/json',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.pdf': 'application/pdf'
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    })

    const stream = fs.createReadStream(filePath)
    stream.pipe(res)

    stream.on('error', (err) => {
      console.error(`Error streaming ${filePath}:`, err)
      res.writeHead(500)
      res.end('Error serving file')
    })

    return
  }

  // 404 for other paths
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`)
  console.log('🎵 CPE Audio File Server')
  console.log('='.repeat(60))
  console.log(`\nServer running on http://localhost:${PORT}`)
  console.log(`Storage path: ${STORAGE_PATH}`)
  console.log(`\nServing files at:`)
  console.log(`  GET /storage/cpe/Primer-Parcial/...`)
  console.log(`\nExample URLs:`)
  console.log(`  - http://localhost:${PORT}/storage/cpe/Primer-Parcial/01-Biomecánica/.../audio.mp3`)
  console.log(`  - http://localhost:${PORT}/storage/cpe/Primer-Parcial/04-Hipertrofia/.../slides/slide-01.jpg`)
  console.log(`\n${'='.repeat(60)}\n`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('\n\nShutting down audio server...')
  server.close(() => process.exit(0))
})
