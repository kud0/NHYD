import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const STORAGE_PATH = path.join(process.cwd(), 'storage', 'cpe', 'Primer-Parcial')

interface ProgressSnapshot {
  timestamp: string
  phase: number
  transcriptFiles: number
  transcriptChunks: number
  notes: number
  summaries: number
  quizzes: number
}

async function countFiles(pattern: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`find "${STORAGE_PATH}" -name "${pattern}" -type f 2>/dev/null | wc -l`)
    return parseInt(stdout.trim()) || 0
  } catch {
    return 0
  }
}

async function getProgress(): Promise<ProgressSnapshot> {
  const transcriptFiles = await countFiles('*_transcript.json')
  const transcriptChunks = await prisma.transcriptChunk.count({
    where: { audioPart: { lesson: { subject: { programId: 'cpe' } } } }
  })
  const notes = await prisma.note.count({
    where: { slide: { lesson: { subject: { programId: 'cpe' } } } }
  })
  const summaries = await prisma.summary.count({
    where: { lesson: { subject: { programId: 'cpe' } } }
  })
  const quizzes = await prisma.quiz.count({
    where: { lesson: { subject: { programId: 'cpe' } } }
  })

  let phase = 4
  if (transcriptFiles > 0) phase = Math.max(phase, 5)
  if (transcriptChunks > 0) phase = Math.max(phase, 5)
  if (notes > 0) phase = Math.max(phase, 6)
  if (summaries > 0) phase = Math.max(phase, 7)
  if (quizzes > 0) phase = 8

  return {
    timestamp: new Date().toISOString(),
    phase,
    transcriptFiles,
    transcriptChunks,
    notes,
    summaries,
    quizzes
  }
}

async function printProgress(snapshot: ProgressSnapshot) {
  console.log('='.repeat(70))
  console.log(`📊 CPE Processing Progress - ${snapshot.timestamp}`)
  console.log('='.repeat(70))
  console.log(`\nCurrent Phase: ${snapshot.phase}/8`)
  console.log('\n✅ Completed:')
  console.log('   - Phase 1: Database Setup (7 subjects)')
  console.log('   - Phase 2: Lesson Structure (30 lessons, 46 audio parts, 1,181 slides)')
  console.log('   - Phase 3: OCR Extraction (1,145 slides with OCR, 97% success)')
  console.log('   - Phase 4: Audio Transcription (46 files submitted to RunPod)')
  console.log('\n⏳ In Progress:')
  console.log(`   - Transcripts downloaded: ${snapshot.transcriptFiles}/46`)
  console.log(`   - Transcript chunks imported: ${snapshot.transcriptChunks}`)
  console.log(`\n📋 Pending:`)
  console.log(`   - Notes generated: ${snapshot.notes}/1,181`)
  console.log(`   - Summaries created: ${snapshot.summaries}/30`)
  console.log(`   - Quizzes generated: ${snapshot.quizzes}/30`)
  console.log('\n' + '='.repeat(70))

  if (snapshot.transcriptFiles > 0) {
    console.log(`\n🚀 Transcription progress detected! (${snapshot.transcriptFiles}/46)`)
  }

  if (snapshot.phase === 8) {
    console.log('\n🎉 ALL PHASES COMPLETE! Ready for QA testing.')
  }
}

async function main() {
  const interval = process.argv.includes('--interval')
    ? parseInt(process.argv.find(a => a.startsWith('--interval='))?.split('=')[1] || '60')
    : 60

  console.log(`\n🔍 Starting CPE progress monitor (${interval}s interval)...`)
  console.log('Press Ctrl+C to stop\n')

  while (true) {
    try {
      const snapshot = await getProgress()
      printProgress(snapshot)

      // Check if Phase 4 transcript chunks exist but Phase 5 hasn't run
      if (snapshot.transcriptChunks > 0 && snapshot.notes === 0) {
        console.log(
          '\n💡 Transcripts ready! Run: npx tsx src/scripts/generate-cpe-summaries.ts'
        )
      }

      await new Promise(r => setTimeout(r, interval * 1000))
    } catch (e) {
      console.error('Error:', e)
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}

if (process.argv.includes('--once')) {
  getProgress()
    .then(printProgress)
    .finally(() => prisma.$disconnect())
} else {
  main().finally(() => prisma.$disconnect())
}
