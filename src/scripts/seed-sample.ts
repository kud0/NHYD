import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface TranscriptSegment {
  id: number
  start: number
  end: number
  text: string
  avg_logprob: number
  no_speech_prob: number
}

interface TranscriptionResult {
  id: string
  status: string
  output?: {
    detected_language: string
    model: string
    segments: TranscriptSegment[]
  }
}

async function main() {
  console.log('🌱 Seeding database with sample content...\n')

  // Create subject
  const subject = await prisma.subject.upsert({
    where: { id: 'sample-anatomy' },
    update: {},
    create: {
      id: 'sample-anatomy',
      name: 'Anatomía y Fisiología Humana',
      description: 'Introducción a la anatomía y fisiología del cuerpo humano',
      color: '#3B82F6',
      icon: '🫀',
    },
  })
  console.log('✅ Subject created:', subject.name)

  // Create lesson
  const lesson = await prisma.lesson.upsert({
    where: { id: 'sample-lesson-1' },
    update: {},
    create: {
      id: 'sample-lesson-1',
      title: 'Clase 1: Introducción a la Anatomía y Fisiología',
      description: 'Conceptos fundamentales, organización estructural del cuerpo humano, homeostasis',
      order: 1,
      subjectId: subject.id,
    },
  })
  console.log('✅ Lesson created:', lesson.title)

  // Create audio parts
  const audioPart1 = await prisma.audioPart.upsert({
    where: { id: 'sample-audio-part1' },
    update: {},
    create: {
      id: 'sample-audio-part1',
      title: 'Parte 1: Conceptos y Organización',
      order: 1,
      audioPath: 'samples/audio_part1.mp3',
      lessonId: lesson.id,
    },
  })
  console.log('✅ Audio Part 1 created:', audioPart1.title)

  const audioPart2 = await prisma.audioPart.upsert({
    where: { id: 'sample-audio-part2' },
    update: {},
    create: {
      id: 'sample-audio-part2',
      title: 'Parte 2: Homeostasis y Medio Interno',
      order: 2,
      audioPath: 'samples/audio_part2.mp3',
      lessonId: lesson.id,
    },
  })
  console.log('✅ Audio Part 2 created:', audioPart2.title)

  // Load and process Part 1 transcription
  const transcriptPath = path.join(__dirname, '../../storage/samples/transcripts/part1_raw.json')

  if (existsSync(transcriptPath)) {
    console.log('\n📝 Processing Part 1 transcription...')
    const transcriptData: TranscriptionResult = JSON.parse(readFileSync(transcriptPath, 'utf-8'))

    if (transcriptData.output?.segments) {
      const segments = transcriptData.output.segments
      console.log(`   Found ${segments.length} segments`)

      // Delete existing chunks for this audio part
      await prisma.transcriptChunk.deleteMany({
        where: { audioPartId: audioPart1.id }
      })

      // Insert transcript chunks
      let insertedCount = 0
      for (const segment of segments) {
        await prisma.transcriptChunk.create({
          data: {
            text: segment.text.trim(),
            startTime: segment.start,
            endTime: segment.end,
            audioPartId: audioPart1.id,
          },
        })
        insertedCount++
      }
      console.log(`   ✅ Inserted ${insertedCount} transcript chunks`)

      // Update audio part duration
      const lastSegment = segments[segments.length - 1]
      await prisma.audioPart.update({
        where: { id: audioPart1.id },
        data: { duration: Math.ceil(lastSegment.end) }
      })
      console.log(`   ✅ Duration: ${Math.ceil(lastSegment.end)} seconds`)
    }
  } else {
    console.log('\n⚠️  Part 1 transcription not found at:', transcriptPath)
  }

  // Check for Part 2 transcription
  const transcript2Path = path.join(__dirname, '../../storage/samples/transcripts/part2_raw.json')
  if (existsSync(transcript2Path)) {
    console.log('\n📝 Processing Part 2 transcription...')
    const transcriptData: TranscriptionResult = JSON.parse(readFileSync(transcript2Path, 'utf-8'))

    if (transcriptData.output?.segments) {
      const segments = transcriptData.output.segments
      console.log(`   Found ${segments.length} segments`)

      await prisma.transcriptChunk.deleteMany({
        where: { audioPartId: audioPart2.id }
      })

      let insertedCount = 0
      for (const segment of segments) {
        await prisma.transcriptChunk.create({
          data: {
            text: segment.text.trim(),
            startTime: segment.start,
            endTime: segment.end,
            audioPartId: audioPart2.id,
          },
        })
        insertedCount++
      }
      console.log(`   ✅ Inserted ${insertedCount} transcript chunks`)

      const lastSegment = segments[segments.length - 1]
      await prisma.audioPart.update({
        where: { id: audioPart2.id },
        data: { duration: Math.ceil(lastSegment.end) }
      })
      console.log(`   ✅ Duration: ${Math.ceil(lastSegment.end)} seconds`)
    }
  } else {
    console.log('\n⏳ Part 2 transcription not yet available')
  }

  // Update lesson status
  await prisma.lesson.update({
    where: { id: lesson.id },
    data: { status: 'PROCESSING' }
  })

  console.log('\n✨ Sample seed complete!')
  console.log('\n📊 Summary:')

  const chunkCount = await prisma.transcriptChunk.count({
    where: { audioPart: { lessonId: lesson.id } }
  })
  console.log(`   - Subjects: 1`)
  console.log(`   - Lessons: 1`)
  console.log(`   - Audio Parts: 2`)
  console.log(`   - Transcript Chunks: ${chunkCount}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
