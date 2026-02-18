import { prisma } from '../lib/db'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

async function generateSummary(slideOCR: string, transcriptText: string): Promise<{ keyPoints: string[], oneLiner: string } | null> {
  const prompt = `Eres un asistente educativo. Analiza esta diapositiva y lo que explico el profesor.

FORMATO (usa EXACTAMENTE):
PUNTOS CLAVE:
• [punto 1]
• [punto 2]
• [punto 3]

EN UNA FRASE: [resumen]

---
DIAPOSITIVA:
${slideOCR.slice(0, 600)}

PROFESOR:
${transcriptText.slice(0, 1200)}`

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })
    if (!res.ok) return null
    const data = await res.json()
    const response = data.response?.trim() || ''
    if (!response) return null

    const keyPoints: string[] = []
    for (const line of response.split('\n')) {
      const t = line.trim()
      if (t.startsWith('•') || t.startsWith('-')) {
        keyPoints.push(t.replace(/^[•\-]\s*/, ''))
      }
    }
    const match = response.match(/EN UNA FRASE:\s*(.+)/i)
    return { keyPoints, oneLiner: match?.[1]?.trim() || '' }
  } catch { return null }
}

async function main() {
  const subjectId = process.argv[2]

  if (!subjectId) {
    console.log('Usage: npx tsx scripts/add-summaries.ts <subjectId>')
    console.log('\nAvailable subjects:')
    const subjects = await prisma.subject.findMany({ select: { id: true, name: true } })
    subjects.forEach(s => console.log(`  ${s.id}: ${s.name}`))
    return
  }

  console.log('='.repeat(60))
  console.log('CLASSMIND - Generate Summaries')
  console.log('='.repeat(60))

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          slides: { orderBy: { order: 'asc' } },
          audioParts: {
            include: { transcriptChunks: { orderBy: { startTime: 'asc' } } },
            orderBy: { order: 'asc' }
          }
        }
      }
    }
  })

  if (!subject) {
    console.log('Subject not found')
    return
  }

  console.log(`\nSubject: ${subject.name}`)
  console.log(`Lessons: ${subject.lessons.length}`)

  // Step 1: Create transcript-slide matches
  console.log('\n[1/2] Matching slides to transcripts...')
  for (const lesson of subject.lessons) {
    const allChunks = lesson.audioParts.flatMap(ap => ap.transcriptChunks)
    const slides = lesson.slides
    if (allChunks.length === 0 || slides.length === 0) continue

    const totalDuration = allChunks[allChunks.length - 1]?.endTime || 0
    const slideInterval = totalDuration / slides.length

    for (const chunk of allChunks) {
      const slideIndex = Math.min(Math.floor(chunk.startTime / slideInterval), slides.length - 1)
      await prisma.transcriptMatch.upsert({
        where: { slideId_transcriptChunkId: { slideId: slides[slideIndex].id, transcriptChunkId: chunk.id } },
        create: { slideId: slides[slideIndex].id, transcriptChunkId: chunk.id, confidenceScore: 0.7 },
        update: {}
      })
    }
    console.log(`  ${lesson.title}: ${allChunks.length} matches`)
  }

  // Step 2: Generate AI summaries
  console.log('\n[2/2] Generating AI summaries...')
  for (const lesson of subject.lessons) {
    const slides = await prisma.slide.findMany({
      where: { lessonId: lesson.id },
      orderBy: { order: 'asc' },
      include: { transcriptMatches: { include: { transcriptChunk: true } } }
    })

    console.log(`  ${lesson.title} (${slides.length} slides)`)
    const allKeyPoints: string[] = []
    let processed = 0

    for (const slide of slides) {
      const ocrText = slide.ocrText || ''
      const transcriptText = slide.transcriptMatches.map(m => m.transcriptChunk.text).join(' ')
      if (!ocrText && !transcriptText) continue

      const summary = await generateSummary(ocrText, transcriptText)
      if (summary && summary.keyPoints.length > 0) {
        allKeyPoints.push(...summary.keyPoints)
        await prisma.note.upsert({
          where: { id: `${slide.id}-summary` },
          create: {
            id: `${slide.id}-summary`,
            lessonId: lesson.id,
            slideId: slide.id,
            content: `${summary.keyPoints.map(kp => `• ${kp}`).join('\n')}\n\n**Resumen:** ${summary.oneLiner}`
          },
          update: { content: `${summary.keyPoints.map(kp => `• ${kp}`).join('\n')}\n\n**Resumen:** ${summary.oneLiner}` }
        })
      }
      processed++
      if (processed % 20 === 0) console.log(`    ${processed}/${slides.length}`)
      await new Promise(r => setTimeout(r, 150))
    }

    // Lesson summary
    if (allKeyPoints.length > 0) {
      const unique = [...new Set(allKeyPoints)].slice(0, 10)
      await prisma.summary.upsert({
        where: { lessonId: lesson.id },
        create: { lessonId: lesson.id, content: unique.map(k => `• ${k}`).join('\n'), keyPoints: unique },
        update: { content: unique.map(k => `• ${k}`).join('\n'), keyPoints: unique }
      })
    }
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: 'READY', isProcessed: true } })
    console.log(`    Done: ${processed} slides`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Done!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
