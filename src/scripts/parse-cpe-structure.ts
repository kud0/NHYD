import * as fs from 'fs'
import * as path from 'path'

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'cpe', 'Primer-Parcial')

interface ParsedPart {
  partNumber: number
  audioFile: string
  slidesFile: string
  title: string
}

interface ParsedLesson {
  claseNumber: number
  parts: ParsedPart[]
}

interface ParsedSubject {
  path: string
  folderName: string
  lessons: ParsedLesson[]
}

interface Manifest {
  parsedAt: string
  totalFiles: number
  subjects: ParsedSubject[]
}

function parseFilename(filename: string): {
  claseNumber: number | null
  partNumber: number | null
  title: string | null
  type: 'audio' | 'slides' | null
  extension: string | null
} {
  // Regex: Clase-(\d+)(?:-Parte-(\d+))?-(.+?)-(audio|slides)\.(mp3|pdf)
  const match = filename.match(/Clase-(\d+)(?:-Parte-(\d+))?-(.+?)-(audio|slides)\.(mp3|pdf)/)
  if (!match) {
    return { claseNumber: null, partNumber: null, title: null, type: null, extension: null }
  }

  return {
    claseNumber: parseInt(match[1]),
    partNumber: match[2] ? parseInt(match[2]) : 1,
    title: match[3],
    type: match[4] as 'audio' | 'slides',
    extension: match[5]
  }
}

async function parseSubjectFolder(folderPath: string, folderName: string): Promise<ParsedSubject> {
  const files = fs.readdirSync(folderPath)
  const parsedFiles = files
    .filter(f => f.match(/Clase-\d+/))
    .map(f => ({ filename: f, parsed: parseFilename(f) }))
    .filter(f => f.parsed.claseNumber !== null)

  // Group by claseNumber
  const lessonMap = new Map<number, Map<number, ParsedPart>>()

  for (const file of parsedFiles) {
    const { claseNumber, partNumber, title, type } = file.parsed
    if (!claseNumber || !partNumber || !title || !type) continue

    if (!lessonMap.has(claseNumber)) {
      lessonMap.set(claseNumber, new Map())
    }

    const partMap = lessonMap.get(claseNumber)!
    if (!partMap.has(partNumber)) {
      partMap.set(partNumber, {
        partNumber,
        audioFile: '',
        slidesFile: '',
        title
      })
    }

    const part = partMap.get(partNumber)!
    if (type === 'audio') {
      part.audioFile = file.filename
    } else {
      part.slidesFile = file.filename
    }
  }

  // Convert to lessons array
  const lessons: ParsedLesson[] = Array.from(lessonMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([claseNumber, partMap]) => ({
      claseNumber,
      parts: Array.from(partMap.values())
        .sort((a, b) => a.partNumber - b.partNumber)
        .filter(p => p.audioFile && p.slidesFile) // Only include complete parts
    }))

  return {
    path: path.relative(STORAGE_PATH, folderPath),
    folderName,
    lessons
  }
}

async function main() {
  const subjectFilter = process.argv
    .find(arg => arg.startsWith('--subject'))
    ?.split('=')[1]

  console.log('='.repeat(60))
  console.log('CLASSMIND - Parse CPE Structure')
  console.log('='.repeat(60))

  if (!fs.existsSync(STORAGE_PATH)) {
    console.error(`Storage path not found: ${STORAGE_PATH}`)
    process.exit(1)
  }

  console.log(`\nScanning: ${STORAGE_PATH}\n`)

  // Find all subject folders (0X-*)
  const subjectFolders = fs
    .readdirSync(STORAGE_PATH)
    .filter(f => /^\d{2}-/.test(f) && fs.statSync(path.join(STORAGE_PATH, f)).isDirectory())
    .sort()

  const manifest: Manifest = {
    parsedAt: new Date().toISOString(),
    totalFiles: 0,
    subjects: []
  }

  let totalFiles = 0

  for (const subjectFolder of subjectFolders) {
    // Filter by subject if specified
    if (subjectFilter && !subjectFolder.includes(subjectFilter)) continue

    const folderPath = path.join(STORAGE_PATH, subjectFolder)
    console.log(`📁 ${subjectFolder}`)

    try {
      const parsed = await parseSubjectFolder(folderPath, subjectFolder)
      manifest.subjects.push(parsed)

      let partCount = 0
      parsed.lessons.forEach(l => {
        partCount += l.parts.length
      })

      const fileCount = parsed.lessons.reduce((sum, l) => {
        return sum + l.parts.length * 2 // audio + slides per part
      }, 0)

      console.log(`   ├─ ${parsed.lessons.length} lessons`)
      console.log(`   ├─ ${partCount} parts`)
      console.log(`   └─ ${fileCount} files (${fileCount / 2} complete pairs)`)

      totalFiles += fileCount
    } catch (err) {
      console.error(`   Error: ${err}`)
    }
  }

  manifest.totalFiles = totalFiles

  // Save manifest
  const manifestPath = '/tmp/cpe-structure-manifest.json'
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   - Subjects: ${manifest.subjects.length}`)
  console.log(`   - Total lessons: ${manifest.subjects.reduce((sum, s) => sum + s.lessons.length, 0)}`)
  console.log(`   - Total parts: ${manifest.subjects.reduce((sum, s) => sum + s.lessons.reduce((ls, l) => ls + l.parts.length, 0), 0)}`)
  console.log(`   - Total files: ${totalFiles}`)
  console.log(`   - Manifest: ${manifestPath}`)
  console.log('='.repeat(60))
}

main().catch(console.error)
