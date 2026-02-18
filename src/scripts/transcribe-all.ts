import * as fs from 'fs'
import * as path from 'path'

const STORAGE_PATH = path.join(process.cwd(), '..', 'storage')
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || ''
const RUNPOD_ENDPOINT = 'https://api.runpod.ai/v2/zhixh7hqgrlu76'
const TUNNEL_URL = process.argv[3] || 'https://devon-shuttle-bent-towers.trycloudflare.com'

interface Job {
  audioPath: string
  jobId: string
  status: string
}

async function submitTranscription(audioPath: string): Promise<string | null> {
  const relativePath = path.relative(STORAGE_PATH, audioPath)
  const audioUrl = `${TUNNEL_URL}/${encodeURIComponent(relativePath).replace(/%2F/g, '/')}`

  console.log(`Submitting: ${path.basename(audioPath)}`)
  console.log(`  URL: ${audioUrl}`)

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

  const data = await res.json()
  if (data.id) {
    console.log(`  Job ID: ${data.id}`)
    return data.id
  } else {
    console.log(`  Error: ${JSON.stringify(data)}`)
    return null
  }
}

async function checkJob(jobId: string): Promise<any> {
  const res = await fetch(`${RUNPOD_ENDPOINT}/status/${jobId}`, {
    headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
  })
  return res.json()
}

async function main() {
  const subjectFolder = process.argv[2]

  if (!subjectFolder) {
    console.log('Usage: npx tsx scripts/transcribe-all.ts "<subject-folder>" [tunnel-url]')
    console.log('\nAvailable subjects:')
    fs.readdirSync(STORAGE_PATH)
      .filter(f => f.startsWith('NHYD'))
      .forEach(f => console.log(`  "${f}"`))
    return
  }

  console.log('='.repeat(60))
  console.log('CLASSMIND - Transcribe All Audio Files')
  console.log('='.repeat(60))
  console.log(`Tunnel: ${TUNNEL_URL}\n`)

  // Find all audio files
  const subjectPath = path.join(STORAGE_PATH, subjectFolder)

  if (!fs.existsSync(subjectPath)) {
    console.log(`Subject not found: ${subjectFolder}`)
    return
  }

  // Handle nested folders (e.g., T1/Parte 1/)
  function findAudioFiles(dir: string): string[] {
    const files: string[] = []
    const entries = fs.readdirSync(dir)

    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      if (fs.statSync(fullPath).isDirectory()) {
        files.push(...findAudioFiles(fullPath))
      } else if (entry.endsWith('.mp3')) {
        files.push(fullPath)
      }
    }
    return files
  }

  const audioFiles = findAudioFiles(subjectPath)

  // Skip files that already have transcripts
  const pendingAudios = audioFiles.filter(f => !fs.existsSync(f.replace('.mp3', '_transcript.json')))

  console.log(`Found ${audioFiles.length} audio files, ${pendingAudios.length} need transcription\n`)

  if (pendingAudios.length === 0) {
    console.log('All files already transcribed!')
    return
  }

  const jobs: Job[] = []

  // Submit all jobs
  console.log('[1/2] Submitting transcription jobs...\n')
  for (const audioPath of pendingAudios) {
    const jobId = await submitTranscription(audioPath)
    if (jobId) {
      jobs.push({ audioPath, jobId, status: 'IN_QUEUE' })
    }
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nSubmitted ${jobs.length} jobs\n`)

  // Wait for completion
  console.log('[2/2] Waiting for transcriptions...\n')
  const completed: Job[] = []

  while (completed.length < jobs.length) {
    for (const job of jobs) {
      if (completed.find(j => j.jobId === job.jobId)) continue

      const status = await checkJob(job.jobId)

      if (status.status === 'COMPLETED') {
        console.log(`✓ ${path.basename(job.audioPath)}`)

        // Save transcript
        const transcriptPath = job.audioPath.replace('.mp3', '_transcript.json')
        fs.writeFileSync(transcriptPath, JSON.stringify(status.output, null, 2))
        console.log(`  Saved: ${path.basename(transcriptPath)}`)

        completed.push({ ...job, status: 'COMPLETED' })
      } else if (status.status === 'FAILED') {
        console.log(`✗ ${path.basename(job.audioPath)}: FAILED`)
        console.log(`  Error: ${status.error?.slice(0, 100)}...`)
        completed.push({ ...job, status: 'FAILED' })
      }
    }

    if (completed.length < jobs.length) {
      const pending = jobs.length - completed.length
      console.log(`\nProgress: ${completed.length}/${jobs.length} (${pending} pending) - waiting 30s...\n`)
      await new Promise(r => setTimeout(r, 30000))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('DONE!')
  console.log(`Completed: ${completed.filter(j => j.status === 'COMPLETED').length}`)
  console.log(`Failed: ${completed.filter(j => j.status === 'FAILED').length}`)
  console.log('='.repeat(60))
}

main().catch(console.error)
