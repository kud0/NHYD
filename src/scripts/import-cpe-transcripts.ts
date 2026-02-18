import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'cpe', 'Primer-Parcial')

interface TranscriptSegment {
  id: number
  seek: number
  start: number
  end: number
  text: string
  tokens?: number[]
  temperature?: number
  avg_logprob?: number
  compression_ratio?: number
  no_speech_prob?: number
}

interface TranscriptFile {
  segments: TranscriptSegment[]
  language: string
}

async function findTranscriptFiles(subjectPath: string): Promise<string[]> {
  const transcripts: string[] = []

  function walk(dir: string) {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (file.endsWith('_transcript.json')) {
        transcripts.push(fullPath)
      }
    }
  }

  walk(subjectPath)
  return transcripts
}

async function main() {
  const subjectFilter = process.argv
    .find(arg => arg.startsWith('--subject'))
    ?.split('=')[1]

  console.log('='.repeat(60))
  console.log('CLASSMIND - Import CPE Transcripts')
  console.log('='.repeat(60))

  // Get all CPE subjects
  const subjects = await prisma.subject.findMany({
    where: { programId: 'cpe' }
  })

  let totalTranscripts = 0
  let totalChunks = 0
  let totalErrors = 0

  for (const subject of subjects) {
    // Filter by subject if specified
    if (subjectFilter && !subject.id.includes(subjectFilter)) continue

    console.log(`\n📚 ${subject.name}`)

    const subjectPath = path.join(STORAGE_PATH, `${String(subject.order).padStart(2, '0')}-`)

    // Find subject folder
    const parentDir = path.dirname(subjectPath)
    let actualSubjectPath = null

    if (fs.existsSync(parentDir)) {
      const folders = fs
        .readdirSync(parentDir)
        .filter(f => f.startsWith(`${String(subject.order).padStart(2, '0')}-`))
        .filter(f =>
          fs
            .statSync(path.join(parentDir, f))
            .isDirectory()
        )

      if (folders.length > 0) {
        actualSubjectPath = path.join(parentDir, folders[0])
      }
    }

    if (!actualSubjectPath) {
      console.log(`  ⚠️  Subject folder not found`)
      continue
    }

    // Find all transcript files
    const transcripts = await findTranscriptFiles(actualSubjectPath)
    console.log(`  Found ${transcripts.length} transcript files`)

    for (const transcriptPath of transcripts) {
      try {
        const transcript: TranscriptFile = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'))
        const audioPath = transcriptPath.replace('_transcript.json', '')
        const audioFilename = path.basename(audioPath)

        // Find matching audio part
        const audioPart = await prisma.audioPart.findFirst({
          where: {
            audioPath: {
              contains: audioFilename.replace('.mp3', '')
            },
            lesson: {
              subjectId: subject.id
            }
          }
        })

        if (!audioPart) {
          console.log(`  ⚠️  No audio part found for ${audioFilename}`)
          totalErrors++
          continue
        }

        // Clear existing chunks
        await prisma.transcriptChunk.deleteMany({
          where: { audioPartId: audioPart.id }
        })

        // Import chunks
        const segments = transcript.segments || []
        for (const segment of segments) {
          await prisma.transcriptChunk.create({
            data: {
              audioPartId: audioPart.id,
              text: segment.text.trim(),
              startTime: segment.start,
              endTime: segment.end
            }
          })
        }

        // Update audio part duration
        if (segments.length > 0) {
          await prisma.audioPart.update({
            where: { id: audioPart.id },
            data: { duration: Math.ceil(segments[segments.length - 1].end) }
          })
        }

        console.log(`    ✓ ${audioFilename}: ${segments.length} chunks`)
        totalTranscripts++
        totalChunks += segments.length
      } catch (e) {
        console.log(`    ✗ Error: ${e}`)
        totalErrors++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   - Transcripts imported: ${totalTranscripts}`)
  console.log(`   - Chunks created: ${totalChunks}`)
  console.log(`   - Errors: ${totalErrors}`)
  console.log('='.repeat(60))
  console.log('\n✨ CPE transcripts import complete!')
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
