import * as fs from 'fs'
import { execSync } from 'child_process'

const TUNNEL_URL = 'https://months-iowa-wide-recently.trycloudflare.com'
const STORAGE_PATH = '/Users/alexsolecarretero/Public/projects/CLASSMIND/storage/cpe/Primer-Parcial'
const LOG_FILE = '/tmp/full-transcription.log'

async function checkTunnelHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(TUNNEL_URL, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

async function restartTunnel(): Promise<void> {
  console.log('\n⚠️  Tunnel health check failed. Restarting...\n')
  try {
    execSync('killall cloudflared 2>/dev/null || true', { stdio: 'ignore' })
    await new Promise(r => setTimeout(r, 2000))

    execSync('cd /Users/alexsolecarretero/Public/projects/CLASSMIND && cloudflared tunnel --url http://localhost:8765 > /tmp/cloudflare.log 2>&1 &', { stdio: 'ignore' })
    console.log('✓ CloudFlare tunnel restarted')

    await new Promise(r => setTimeout(r, 3000))
  } catch (e) {
    console.error('Failed to restart tunnel:', e)
  }
}

async function countTranscripts(): Promise<number> {
  try {
    const files = execSync(`find ${STORAGE_PATH} -name "*_transcript.json" | wc -l`, { encoding: 'utf-8' })
    return parseInt(files.trim())
  } catch {
    return 0
  }
}

async function areTranscriptionsComplete(): Promise<boolean> {
  const count = await countTranscripts()
  return count >= 46
}

async function runPhase5(): Promise<void> {
  console.log('\n🚀 Phase 4 Complete! Starting Phase 5: Import Transcripts...\n')
  try {
    execSync('npx tsx src/scripts/import-cpe-transcripts.ts', {
      cwd: '/Users/alexsolecarretero/Public/projects/CLASSMIND',
      stdio: 'inherit'
    })
    console.log('\n✅ Phase 5 Complete!\n')
    await runPhase6()
  } catch (e) {
    console.error('Phase 5 failed:', e)
  }
}

async function runPhase6(): Promise<void> {
  console.log('\n🚀 Starting Phase 6-7: Generate AI Summaries...\n')
  try {
    execSync('npx tsx src/scripts/generate-cpe-summaries.ts', {
      cwd: '/Users/alexsolecarretero/Public/projects/CLASSMIND',
      stdio: 'inherit'
    })
    console.log('\n✅ Phase 6-7 Complete!\n')
    await runPhase8()
  } catch (e) {
    console.error('Phase 6-7 failed:', e)
  }
}

async function runPhase8(): Promise<void> {
  console.log('\n🚀 Starting Phase 8: Generate Quizzes...\n')
  try {
    execSync('npx tsx src/scripts/generate-cpe-quizzes.ts', {
      cwd: '/Users/alexsolecarretero/Public/projects/CLASSMIND',
      stdio: 'inherit'
    })
    console.log('\n✅ Phase 8 Complete! All CPE processing finished!\n')
  } catch (e) {
    console.error('Phase 8 failed:', e)
  }
}

async function main() {
  console.log('🔄 Monitoring CPE transcription pipeline...\n')

  let lastHealthCheck = Date.now()
  const HEALTH_CHECK_INTERVAL = 30000 // Every 30 seconds

  while (true) {
    try {
      // Health check tunnel every 30 seconds
      if (Date.now() - lastHealthCheck > HEALTH_CHECK_INTERVAL) {
        const isHealthy = await checkTunnelHealth()
        if (!isHealthy) {
          await restartTunnel()
        }
        lastHealthCheck = Date.now()
      }

      // Check if transcriptions are complete
      const transcriptCount = await countTranscripts()
      if (transcriptCount >= 46) {
        console.log(`\n✅ All 46 transcripts completed! (${transcriptCount} files)\n`)
        await runPhase5()
        break
      }

      // Show progress every minute
      const logContent = fs.readFileSync(LOG_FILE, 'utf-8')
      const lastLine = logContent.split('\n').filter(l => l.trim()).pop()
      if (lastLine) {
        console.log(`[${new Date().toLocaleTimeString()}] ${lastLine}`)
      }

      await new Promise(r => setTimeout(r, 10000)) // Check every 10 seconds
    } catch (e) {
      console.error('Monitor error:', e)
      await new Promise(r => setTimeout(r, 10000))
    }
  }
}

main().catch(console.error)
