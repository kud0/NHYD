import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../lib/db'

const STORAGE_PATH = path.join(process.cwd(), '..', 'storage')

interface WordSegment {
  word: string
  start: number
  end: number
}

interface TranscriptOutput {
  text: string
  segments?: Array<{
    text: string
    start: number
    end: number
    words?: WordSegment[]
  }>
  words?: WordSegment[]
}

async function findAudioPart(audioFileName: string, subjectFolder: string): Promise<string | null> {
  // Find the audio part by matching the audio file name
  const audioPart = await prisma.audioPart.findFirst({
    where: {
      audioPath: {
        contains: audioFileName
      }
    }
  })
  return audioPart?.id || null
}

async function importTranscripts(subjectFolder: string) {
  console.log('='.repeat(60))
  console.log('CLASSMIND - Import Transcripts')
  console.log('='.repeat(60))
  console.log(`Subject: ${subjectFolder}\n`)

  const subjectPath = path.join(STORAGE_PATH, subjectFolder)

  if (!fs.existsSync(subjectPath)) {
    console.log(`Subject folder not found: ${subjectFolder}`)
    return
  }

  // Find all transcript files recursively
  function findTranscripts(dir: string): { transcriptPath: string; audioName: string }[] {
    const files: { transcriptPath: string; audioName: string }[] = []
    const entries = fs.readdirSync(dir)

    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      if (fs.statSync(fullPath).isDirectory()) {
        files.push(...findTranscripts(fullPath))
      } else if (entry.endsWith('_transcript.json')) {
        const audioName = entry.replace('_transcript.json', '.mp3')
        files.push({ transcriptPath: fullPath, audioName })
      }
    }
    return files
  }

  const transcripts = findTranscripts(subjectPath)
  console.log(`Found ${transcripts.length} transcript files\n`)

  let imported = 0
  let skipped = 0

  for (const { transcriptPath, audioName } of transcripts) {
    console.log(`Processing: ${audioName}`)

    // Find the audio part
    const audioPart = await prisma.audioPart.findFirst({
      where: {
        audioPath: {
          contains: audioName
        }
      },
      include: {
        transcriptChunks: true
      }
    })

    if (!audioPart) {
      console.log(`  ⚠ Audio part not found in DB, skipping`)
      skipped++
      continue
    }

    // Check if already imported
    if (audioPart.transcriptChunks.length > 0) {
      console.log(`  ✓ Already imported (${audioPart.transcriptChunks.length} chunks)`)
      skipped++
      continue
    }

    // Read transcript
    const transcriptData: TranscriptOutput = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'))

    // Create transcript chunks from segments
    const chunks: { text: string; startTime: number; endTime: number }[] = []

    if (transcriptData.segments && transcriptData.segments.length > 0) {
      // Use segments (preferred - they have timing info)
      for (const segment of transcriptData.segments) {
        if (segment.text.trim()) {
          chunks.push({
            text: segment.text.trim(),
            startTime: segment.start,
            endTime: segment.end
          })
        }
      }
    } else if (transcriptData.words && transcriptData.words.length > 0) {
      // Fall back to words - group them into chunks of ~20 words
      let currentChunk: WordSegment[] = []
      const WORDS_PER_CHUNK = 20

      for (const word of transcriptData.words) {
        currentChunk.push(word)
        if (currentChunk.length >= WORDS_PER_CHUNK) {
          chunks.push({
            text: currentChunk.map(w => w.word).join(' '),
            startTime: currentChunk[0].start,
            endTime: currentChunk[currentChunk.length - 1].end
          })
          currentChunk = []
        }
      }
      // Remaining words
      if (currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.map(w => w.word).join(' '),
          startTime: currentChunk[0].start,
          endTime: currentChunk[currentChunk.length - 1].end
        })
      }
    } else if (transcriptData.text) {
      // Last resort - single chunk with full text
      chunks.push({
        text: transcriptData.text,
        startTime: 0,
        endTime: 0
      })
    }

    if (chunks.length === 0) {
      console.log(`  ⚠ No transcript content found`)
      skipped++
      continue
    }

    // Import chunks to database
    await prisma.transcriptChunk.createMany({
      data: chunks.map(chunk => ({
        audioPartId: audioPart.id,
        text: chunk.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime
      }))
    })

    console.log(`  ✓ Imported ${chunks.length} chunks`)
    imported++
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Done! Imported: ${imported}, Skipped: ${skipped}`)
  console.log('='.repeat(60))
}

async function main() {
  const subjectFolder = process.argv[2]

  if (!subjectFolder) {
    console.log('Usage: npx tsx scripts/import-transcripts.ts "<subject-folder>"')
    console.log('\nAvailable subjects:')
    fs.readdirSync(STORAGE_PATH)
      .filter(f => f.startsWith('NHYD'))
      .forEach(f => console.log(`  "${f}"`))
    return
  }

  await importTranscripts(subjectFolder)
}

main().catch(console.error).finally(() => prisma.$disconnect())
