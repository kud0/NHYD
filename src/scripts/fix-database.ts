import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'

const STORAGE_PATH = path.join(process.cwd(), '..', 'storage')

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function main() {
  console.log('='.repeat(60))
  console.log('CLASSMIND - Fix Database')
  console.log('='.repeat(60))

  // Step 1: Delete all existing audio parts and transcript chunks (cascade will handle it)
  console.log('\n[1/3] Cleaning existing data...')
  await prisma.transcriptChunk.deleteMany({})
  await prisma.audioPart.deleteMany({})
  await prisma.transcriptMatch.deleteMany({})
  await prisma.note.deleteMany({})
  await prisma.summary.deleteMany({})
  console.log('  Done')

  // Step 2: Re-import audio parts with transcripts
  console.log('\n[2/3] Re-importing audio parts and transcripts...')

  const subjectPath = path.join(STORAGE_PATH, 'NHYD - 01 Anatomía y Fisiología humana')
  const topics = fs.readdirSync(subjectPath)
    .filter(f => f.startsWith('T') && fs.statSync(path.join(subjectPath, f)).isDirectory())
    .sort()

  for (const topic of topics) {
    const topicPath = path.join(subjectPath, topic)
    const lessonId = slugify(topic)

    console.log(`  ${topic}`)

    // Find transcripts
    const transcriptFiles = fs.readdirSync(topicPath).filter(f => f.endsWith('_transcript.json'))
    const audioFiles = fs.readdirSync(topicPath).filter(f => f.endsWith('.mp3')).sort()

    // Map transcripts to audios
    const audioTranscripts: Map<string, any> = new Map()
    for (const tf of transcriptFiles) {
      const audioName = tf.replace('_transcript.json', '.mp3')
      const transcriptPath = path.join(topicPath, tf)
      try {
        const data = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'))
        audioTranscripts.set(audioName, data)
      } catch {}
    }

    // Create audio parts
    for (let i = 0; i < audioFiles.length; i++) {
      const audioFile = audioFiles[i]
      const audioPath = path.join(topicPath, audioFile)
      const relativePath = path.relative(STORAGE_PATH, audioPath)
      const transcript = audioTranscripts.get(audioFile)
      const segments = transcript?.segments || []
      const duration = segments.length > 0 ? Math.ceil(segments[segments.length - 1]?.end || 0) : null

      const audioPartId = `${lessonId}-audio${i}`

      // Create audio part
      await prisma.audioPart.create({
        data: {
          id: audioPartId,
          lessonId,
          title: audioFiles.length > 1 ? `Parte ${i + 1}` : 'Audio completo',
          order: i,
          audioPath: relativePath,
          duration
        }
      })

      // Create transcript chunks
      for (const seg of segments) {
        await prisma.transcriptChunk.create({
          data: {
            id: `${audioPartId}-seg${seg.id}`,
            audioPartId,
            text: seg.text,
            startTime: seg.start,
            endTime: seg.end
          }
        })
      }
      console.log(`    Audio ${i + 1}: ${segments.length} segments`)
    }
  }

  // Step 3: Delete old part1/part2 audio parts
  console.log('\n[3/3] Cleaning old sample data...')
  await prisma.audioPart.deleteMany({ where: { id: { contains: '-part' } } })
  await prisma.lesson.deleteMany({ where: { id: 'sample-lesson-1' } })
  console.log('  Done')

  // Final count
  const chunks = await prisma.transcriptChunk.count()
  const parts = await prisma.audioPart.count()
  console.log(`\nResult: ${parts} audio parts, ${chunks} transcript chunks`)

  console.log('\n' + '='.repeat(60))
  console.log('Database fixed!')
  console.log('='.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
