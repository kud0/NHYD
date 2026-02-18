import { execSync } from 'child_process'
import * as fs from 'fs'

const STORAGE_PATH = '/Users/alexsolecarretero/Public/projects/CLASSMIND/storage/cpe/Primer-Parcial'

console.log('\n' + '='.repeat(70))
console.log('📊 CLASSMIND CPE PROCESSING STATUS')
console.log('='.repeat(70) + '\n')

try {
  // Check processes
  const transcriptProcesses = execSync('ps aux | grep transcribe-cpe | grep -v grep | wc -l', { encoding: 'utf-8' }).trim()
  const monitorProcesses = execSync('ps aux | grep monitor-and-continue | grep -v grep | wc -l', { encoding: 'utf-8' }).trim()
  const fileServerProcesses = execSync('ps aux | grep simple-file-server | grep -v grep | wc -l', { encoding: 'utf-8' }).trim()
  const cloudflareProcesses = execSync('ps aux | grep cloudflared | grep -v grep | wc -l', { encoding: 'utf-8' }).trim()

  console.log('🔄 RUNNING PROCESSES:')
  console.log(`  Transcription: ${transcriptProcesses > 0 ? '✅ Running' : '❌ Stopped'}`)
  console.log(`  Monitor: ${monitorProcesses > 0 ? '✅ Running' : '❌ Stopped'}`)
  console.log(`  File Server: ${fileServerProcesses > 0 ? '✅ Running' : '❌ Stopped'}`)
  console.log(`  CloudFlare: ${cloudflareProcesses > 0 ? '✅ Running' : '❌ Stopped'}`)

  // Check transcripts
  const transcriptFiles = execSync(`find ${STORAGE_PATH} -name "*_transcript.json" | wc -l`, { encoding: 'utf-8' }).trim()
  console.log(`\n📝 TRANSCRIPTS COMPLETED: ${transcriptFiles}/46`)

  // Check file server
  const tunnelTest = execSync('curl -s "https://months-iowa-wide-recently.trycloudflare.com/" | head -1', { encoding: 'utf-8' }).trim()
  console.log(`\n🌐 CLOUDFLARE TUNNEL: ${tunnelTest === 'CPE Audio Files Server' ? '✅ Healthy' : '❌ Not responding'}`)
  console.log(`   URL: https://months-iowa-wide-recently.trycloudflare.com`)

  // Log files
  console.log(`\n📋 LOG FILES:`)
  console.log(`   Full transcription: tail -50 /tmp/full-transcription.log`)
  console.log(`   Monitor: tail -50 /tmp/monitor.log`)
  console.log(`   Biomec test: tail -50 /tmp/transcribe-test.log`)

  console.log(`\n⏱️  TIMELINE:`)
  console.log(`   Phase 4 (Transcription): 30-45 hours estimated`)
  console.log(`   Phase 5 (Import): ~5 minutes`)
  console.log(`   Phase 6-7 (Summaries): ~1 hour`)
  console.log(`   Phase 8 (Quizzes): ~30 minutes`)

  console.log(`\n💡 NEXT STEPS:`)
  console.log(`   - Monitor logs with: tail -f /tmp/full-transcription.log`)
  console.log(`   - Check status with: npx tsx src/scripts/status-cpe.ts`)
  console.log(`   - If tunnel fails, monitor will auto-restart it`)
  console.log(`   - When Phase 4 completes, Phases 5-8 run automatically`)

  console.log('\n' + '='.repeat(70) + '\n')
} catch (e) {
  console.error('Status check failed:', e)
}
