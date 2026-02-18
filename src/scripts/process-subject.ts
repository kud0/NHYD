import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const STORAGE_PATH = path.join(process.cwd(), '..', 'storage')
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || ''
const RUNPOD_ENDPOINT = 'https://api.runpod.ai/v2/zhixh7hqgrlu76'

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function extractSlides(pdfPath: string, outputDir: string): Promise<string[]> {
  console.log(`    Extracting: ${path.basename(pdfPath)}`)
  try {
    await execAsync(`pdftoppm -jpeg -r 150 "${pdfPath}" "${outputDir}/slide"`)
    const slides = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('slide') && f.endsWith('.jpg'))
      .sort()
    console.log(`      → ${slides.length} slides`)
    return slides.map(s => path.join(outputDir, s))
  } catch (e) {
    console.log(`      Error: ${e}`)
    return []
  }
}

async function submitTranscription(audioPath: string, tunnelUrl: string): Promise<string | null> {
  const relativePath = path.relative(STORAGE_PATH, audioPath)
  const audioUrl = `${tunnelUrl}/api/storage/${encodeURIComponent(relativePath).replace(/%2F/g, '/')}`
  console.log(`  Submitting: ${path.basename(audioPath)}`)

  const res = await fetch(`${RUNPOD_ENDPOINT}/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: { audio: audioUrl, model: 'large-v3', transcription: 'plain_text', language: 'es', word_timestamps: true }
    })
  })
  const data = await res.json()
  if (data.id) console.log(`    Job ID: ${data.id}`)
  return data.id || null
}

async function checkJob(jobId: string): Promise<any> {
  const res = await fetch(`${RUNPOD_ENDPOINT}/status/${jobId}`, {
    headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
  })
  return res.json()
}

// Find all content folders (handles both flat and nested structures)
function findContentFolders(topicPath: string): { folder: string; partName: string }[] {
  const items = fs.readdirSync(topicPath)
  const subfolders = items.filter(f => {
    const fullPath = path.join(topicPath, f)
    return fs.statSync(fullPath).isDirectory() && f !== 'slides'
  })

  // Check if subfolders contain PDFs/MP3s (nested structure)
  const nestedFolders = subfolders.filter(f => {
    const fullPath = path.join(topicPath, f)
    const contents = fs.readdirSync(fullPath)
    return contents.some(c => c.endsWith('.pdf') || c.endsWith('.mp3'))
  })

  if (nestedFolders.length > 0) {
    // Nested structure: T1/Parte1/, T1/Parte2/
    return nestedFolders.map(f => ({ folder: path.join(topicPath, f), partName: f }))
  } else {
    // Flat structure: files directly in T1/
    return [{ folder: topicPath, partName: '' }]
  }
}

async function main() {
  const subjectFolder = process.argv[2]
  const tunnelUrl = process.argv[3]

  if (!subjectFolder) {
    console.log('Usage: npx tsx scripts/process-subject.ts "<subject-folder>" [tunnel-url]')
    console.log('\nAvailable subjects:')
    fs.readdirSync(STORAGE_PATH)
      .filter(f => f.startsWith('NHYD') && fs.statSync(path.join(STORAGE_PATH, f)).isDirectory())
      .forEach(f => console.log(`  "${f}"`))
    return
  }

  const subjectPath = path.join(STORAGE_PATH, subjectFolder)
  if (!fs.existsSync(subjectPath)) {
    console.log(`Not found: ${subjectPath}`)
    return
  }

  console.log('='.repeat(60))
  console.log('CLASSMIND - Process Subject')
  console.log('='.repeat(60))

  const match = subjectFolder.match(/NHYD - (\d+) (.+)/)
  if (!match) {
    console.log('Invalid folder format. Expected: "NHYD - XX Name"')
    return
  }

  // Note: Folder number (01, 02...) is ordering, NOT semester
  // All NHYD subjects are semester 1
  const semester = 1
  const subjectName = match[2]
  const subjectId = slugify(subjectName)

  // Create subject
  console.log('\n[1/5] Creating subject...')
  const subject = await prisma.subject.upsert({
    where: { id: subjectId },
    create: {
      id: subjectId,
      name: subjectName,
      semester,
      programId: 'nhyd',  // CRITICAL: Link to NHYD program
      color: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'][semester % 5],
      icon: ['🧬', '🌍', '🧪', '🥗', '💪'][semester % 5]
    },
    update: { name: subjectName, semester, programId: 'nhyd' }
  })
  console.log(`  ${subject.id}`)

  const topics = fs.readdirSync(subjectPath)
    .filter(f => f.startsWith('T') && fs.statSync(path.join(subjectPath, f)).isDirectory())
    .sort()
  console.log(`  ${topics.length} lessons`)

  // Process lessons
  console.log('\n[2/5] Processing lessons...')
  const allAudioFiles: { path: string; lessonId: string; partIndex: number }[] = []

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i]
    const topicPath = path.join(subjectPath, topic)
    const lessonId = slugify(topic)

    console.log(`\n  ${topic}`)

    // Create lesson
    await prisma.lesson.upsert({
      where: { id: lessonId },
      create: { id: lessonId, title: topic, order: i, subjectId: subject.id, status: 'PENDING' },
      update: { title: topic, order: i }
    })

    // Find content folders (handles nested parts)
    const contentFolders = findContentFolders(topicPath)
    let slideOffset = 0
    let partIndex = 0

    for (const { folder, partName } of contentFolders) {
      if (partName) console.log(`    Part: ${partName}`)

      // Find and extract PDFs
      const pdfs = fs.readdirSync(folder).filter(f => f.endsWith('.pdf'))
      for (const pdf of pdfs) {
        const pdfPath = path.join(folder, pdf)
        const slidesDir = path.join(folder, 'slides')
        if (!fs.existsSync(slidesDir)) fs.mkdirSync(slidesDir, { recursive: true })

        const existingSlides = fs.readdirSync(slidesDir).filter(f => f.endsWith('.jpg'))
        if (existingSlides.length === 0) {
          await extractSlides(pdfPath, slidesDir)
        }

        // Import slides
        const slides = fs.readdirSync(slidesDir).filter(f => f.endsWith('.jpg')).sort()
        for (let j = 0; j < slides.length; j++) {
          const slideFile = slides[j]
          const relativePath = path.relative(STORAGE_PATH, path.join(slidesDir, slideFile))
          const slideOrder = slideOffset + j

          await prisma.slide.upsert({
            where: { id: `${lessonId}-slide-${slideOrder}` },
            create: { id: `${lessonId}-slide-${slideOrder}`, lessonId, order: slideOrder, imagePath: relativePath },
            update: { order: slideOrder, imagePath: relativePath }
          })
        }
        console.log(`    ${slides.length} slides imported`)
        slideOffset += slides.length
      }

      // Find audio files
      const audios = fs.readdirSync(folder).filter(f => f.endsWith('.mp3'))
      for (const audio of audios) {
        const audioPath = path.join(folder, audio)
        const relativePath = path.relative(STORAGE_PATH, audioPath)
        const audioPartId = `${lessonId}-audio-${partIndex}`

        await prisma.audioPart.upsert({
          where: { id: audioPartId },
          create: { id: audioPartId, lessonId, title: partName || `Parte ${partIndex + 1}`, order: partIndex, audioPath: relativePath },
          update: { audioPath: relativePath, title: partName || `Parte ${partIndex + 1}` }
        })

        allAudioFiles.push({ path: audioPath, lessonId, partIndex })
        partIndex++
      }
      if (audios.length > 0) console.log(`    ${audios.length} audio file(s)`)
    }
  }

  // Transcription
  if (tunnelUrl) {
    console.log('\n[3/5] Transcribing...')
    const jobs: { audioPath: string; jobId: string; lessonId: string; partIndex: number }[] = []

    for (const audio of allAudioFiles) {
      const transcriptPath = audio.path.replace('.mp3', '_transcript.json')
      if (fs.existsSync(transcriptPath)) {
        console.log(`  Skipping ${path.basename(audio.path)} (done)`)
        continue
      }
      const jobId = await submitTranscription(audio.path, tunnelUrl)
      if (jobId) jobs.push({ ...audio, audioPath: audio.path, jobId })
      await new Promise(r => setTimeout(r, 500))
    }

    if (jobs.length > 0) {
      console.log(`\n  Waiting for ${jobs.length} jobs...`)
      const completed: string[] = []
      while (completed.length < jobs.length) {
        for (const job of jobs) {
          if (completed.includes(job.jobId)) continue
          const status = await checkJob(job.jobId)
          if (status.status === 'COMPLETED') {
            fs.writeFileSync(job.audioPath.replace('.mp3', '_transcript.json'), JSON.stringify(status.output, null, 2))
            console.log(`  ✓ ${path.basename(job.audioPath)}`)
            completed.push(job.jobId)
          } else if (status.status === 'FAILED') {
            console.log(`  ✗ ${path.basename(job.audioPath)}`)
            completed.push(job.jobId)
          }
        }
        if (completed.length < jobs.length) {
          console.log(`  ${completed.length}/${jobs.length} - waiting 30s...`)
          await new Promise(r => setTimeout(r, 30000))
        }
      }
    }
  } else {
    console.log('\n[3/5] Skipping transcription (no tunnel)')
  }

  // Import transcripts
  console.log('\n[4/5] Importing transcripts...')
  for (const audio of allAudioFiles) {
    const transcriptPath = audio.path.replace('.mp3', '_transcript.json')
    if (!fs.existsSync(transcriptPath)) continue

    const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'))
    const segments = transcript.segments || []
    const audioPartId = `${audio.lessonId}-audio-${audio.partIndex}`

    await prisma.transcriptChunk.deleteMany({ where: { audioPartId } })

    for (const seg of segments) {
      await prisma.transcriptChunk.create({
        data: { audioPartId, text: seg.text.trim(), startTime: seg.start, endTime: seg.end }
      })
    }

    if (segments.length > 0) {
      await prisma.audioPart.update({
        where: { id: audioPartId },
        data: { duration: Math.ceil(segments[segments.length - 1].end) }
      })
    }
    console.log(`  ${path.basename(audio.path)}: ${segments.length} segments`)
  }

  // Update status
  console.log('\n[5/5] Finalizing...')
  for (const topic of topics) {
    await prisma.lesson.update({
      where: { id: slugify(topic) },
      data: { status: 'READY', isProcessed: true }
    })
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Done! ${subjectName}: ${topics.length} lessons`)
  console.log('='.repeat(60))
}

main().catch(console.error).finally(() => prisma.$disconnect())
