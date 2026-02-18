import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'cpe', 'Primer-Parcial')
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || ''
const RUNPOD_ENDPOINT = 'https://api.runpod.ai/v2/zhixh7hqgrlu76'

interface RunPodJob {
  id: string
  audioPath: string
  audioPartId: string
  attempt: number
}

async function submitTranscription(audioPath: string, tunnelUrl: string): Promise<string | null> {
  const relativePath = path.relative(STORAGE_PATH, audioPath)
  // Encode each path segment separately to preserve directory structure
  const encodedPath = relativePath.split(path.sep).map(segment => encodeURIComponent(segment)).join('/')
  const audioUrl = `${tunnelUrl}/${encodedPath}`

  try {
    const res = await fetch(`${RUNPOD_ENDPOINT}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          audio: audioUrl,
          model: 'large-v3',
          transcription: 'plain_text',
          language: 'es',
          word_timestamps: true
        }
      })
    })

    const data = (await res.json()) as any
    return data.id || null
  } catch (e) {
    console.error(`    Submit error: ${e}`)
    return null
  }
}

async function checkJob(jobId: string): Promise<any> {
  try {
    const res = await fetch(`${RUNPOD_ENDPOINT}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
    })
    return res.json()
  } catch (e) {
    console.error(`    Status check error: ${e}`)
    return null
  }
}

async function main() {
  const subjectFilter = process.argv
    .find(arg => arg.startsWith('--subject'))
    ?.split('=')[1]
  let tunnelUrl = process.argv
    .find(arg => arg.startsWith('--tunnel'))
    ?.split('=')[1]

  console.log('='.repeat(60))
  console.log('CLASSMIND - Transcribe CPE Audio')
  console.log('='.repeat(60))

  // Default to CloudFlare tunnel if no tunnel provided
  if (!tunnelUrl) {
    tunnelUrl = 'https://months-iowa-wide-recently.trycloudflare.com'
    console.log('\nUsing CloudFlare tunnel')
  }

  console.log(`\nAudio Server URL: ${tunnelUrl}\n`)

  // Find all CPE audio parts without transcripts
  const audioParts = await prisma.audioPart.findMany({
    where: {
      lesson: {
        subject: {
          programId: 'cpe'
        }
      },
      transcriptChunks: {
        none: {}
      }
    },
    include: {
      lesson: {
        include: { subject: true }
      }
    }
  })

  console.log(`\n🎙️  Found ${audioParts.length} audio parts to transcribe\n`)

  if (audioParts.length === 0) {
    console.log('All audio already transcribed!')
    return
  }

  // Filter by subject if specified
  let toProcess = audioParts
  if (subjectFilter) {
    toProcess = audioParts.filter(ap => ap.lesson.subject.id.includes(subjectFilter))
    console.log(`Filtered to ${toProcess.length} parts for ${subjectFilter}\n`)
  }

  const jobs: RunPodJob[] = []

  // Submit jobs
  console.log('[1/2] Submitting transcription jobs...')
  for (const audioPart of toProcess) {
    const audioPath = path.join(STORAGE_PATH, audioPart.audioPath)
    const transcriptPath = audioPath.replace('.mp3', '_transcript.json')

    // Skip if already transcribed
    if (fs.existsSync(transcriptPath)) {
      console.log(`  ✓ ${path.basename(audioPath)} (cached)`)
      continue
    }

    console.log(`  Submitting: ${audioPart.lesson.subject.name} - ${path.basename(audioPath)}`)

    const jobId = await submitTranscription(audioPath, tunnelUrl)
    if (jobId) {
      jobs.push({
        id: jobId,
        audioPath,
        audioPartId: audioPart.id,
        attempt: 1
      })
      console.log(`    Job ID: ${jobId}`)
    } else {
      console.log(`    Failed to submit`)
    }

    await new Promise(r => setTimeout(r, 500))
  }

  if (jobs.length === 0) {
    console.log('\nNo jobs to process.')
    return
  }

  // Wait for jobs
  console.log(`\n[2/2] Waiting for ${jobs.length} transcription jobs...`)
  const completed: string[] = []
  let iteration = 0

  while (completed.length < jobs.length) {
    iteration++
    let completedThisRound = 0

    for (const job of jobs) {
      if (completed.includes(job.id)) continue

      const status = await checkJob(job.id)
      if (!status) continue

      if (status.status === 'COMPLETED') {
        fs.writeFileSync(job.audioPath.replace('.mp3', '_transcript.json'), JSON.stringify(status.output, null, 2))
        console.log(`  ✓ ${path.basename(job.audioPath)}`)
        completed.push(job.id)
        completedThisRound++
      } else if (status.status === 'FAILED') {
        console.log(`  ✗ ${path.basename(job.audioPath)} (job failed)`)
        completed.push(job.id)
        completedThisRound++
      }
    }

    if (completed.length < jobs.length) {
      const remaining = jobs.length - completed.length
      const elapsed = iteration * 30
      console.log(`  ${completed.length}/${jobs.length} done (${remaining} remaining, ${elapsed}s elapsed)... waiting 30s`)
      await new Promise(r => setTimeout(r, 30000))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   - Submitted: ${jobs.length}`)
  console.log(`   - Completed: ${completed.length}`)
  console.log('='.repeat(60))
  console.log('\n✨ CPE transcription complete!')
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
