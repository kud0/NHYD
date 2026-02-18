import { prisma } from '../lib/db'
import * as fs from 'fs'

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || ''
const RUNPOD_ENDPOINT = 'https://api.runpod.ai/v2/zhixh7hqgrlu76'

interface Job { id: string; audioPartId: string; name: string }

async function importTranscript(job: Job, result: any) {
  const text = result?.transcription
  if (text === undefined || text === null) return false

  const wordTimestamps = result.word_timestamps || []
  const endTime = wordTimestamps.length > 0 ? wordTimestamps[wordTimestamps.length - 1]?.end || 0 : 0

  const existing = await prisma.transcriptChunk.findFirst({
    where: { audioPartId: job.audioPartId }
  })
  if (existing) return true

  await prisma.transcriptChunk.create({
    data: {
      audioPartId: job.audioPartId,
      startTime: 0,
      endTime: endTime,
      text: text
    }
  })
  return true
}

async function main() {
  const jobs: Job[] = JSON.parse(fs.readFileSync('/tmp/runpod-jobs.json', 'utf-8'))

  console.log('═══════════════════════════════════════════════════════')
  console.log('MONITORING 42 TRANSCRIPTION JOBS')
  console.log('═══════════════════════════════════════════════════════\n')

  const completed = new Set<string>()
  const failed = new Set<string>()

  let attempts = 0
  const maxAttempts = 120

  while (completed.size + failed.size < jobs.length && attempts < maxAttempts) {
    let inProgress = 0, inQueue = 0

    for (const job of jobs) {
      if (completed.has(job.id) || failed.has(job.id)) continue

      const res = await fetch(`${RUNPOD_ENDPOINT}/status/${job.id}`, {
        headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
      })
      const data = await res.json() as any

      if (data.status === 'COMPLETED') {
        try {
          await importTranscript(job, data.output)
          console.log(`✓ ${job.name.substring(0,60)}`)
          completed.add(job.id)
        } catch (e: any) {
          console.log(`✗ Import error: ${job.name}`)
          failed.add(job.id)
        }
      } else if (data.status === 'FAILED') {
        console.log(`✗ RunPod failed: ${job.name}`)
        failed.add(job.id)
      } else if (data.status === 'IN_PROGRESS') {
        inProgress++
      } else {
        inQueue++
      }

      await new Promise(r => setTimeout(r, 100))
    }

    if (completed.size + failed.size < jobs.length) {
      console.log(`\n[${completed.size}/42 done | ${inProgress} processing | ${inQueue} queued] - waiting 30s...\n`)
      await new Promise(r => setTimeout(r, 30000))
    }
    attempts++
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`FINAL: ${completed.size}/42 completed, ${failed.size} failed`)
  console.log('═══════════════════════════════════════════════════════')

  await prisma.$disconnect()
}

main().catch(console.error)
