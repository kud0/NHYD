import { prisma } from '../lib/db'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

interface SummaryResult {
  keyPoints: string[]
  oneLiner: string
}

async function generateSummary(slideOCR: string, transcriptText: string): Promise<SummaryResult | null> {
  const prompt = `Eres un asistente educativo especializado en nutrición y dietética. Analiza esta diapositiva y lo que explica el profesor.

FORMATO (usa EXACTAMENTE este formato):
PUNTOS CLAVE:
• [punto 1]
• [punto 2]
• [punto 3]

EN UNA FRASE: [resumen en una sola línea]

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

    const data = (await res.json()) as any
    const response = data.response?.trim() || ''

    if (!response) return null

    // Parse key points
    const keyPoints: string[] = []
    for (const line of response.split('\n')) {
      const t = line.trim()
      if (t.startsWith('•') || t.startsWith('-')) {
        keyPoints.push(t.replace(/^[•\-]\s*/, ''))
      }
    }

    // Parse one-liner
    const match = response.match(/EN UNA FRASE:\s*(.+)/i)
    const oneLiner = match?.[1]?.trim() || ''

    return keyPoints.length > 0 ? { keyPoints, oneLiner } : null
  } catch (e) {
    return null
  }
}

async function main() {
  const subjectFilter = process.argv
    .find(arg => arg.startsWith('--subject'))
    ?.split('=')[1]

  console.log('='.repeat(60))
  console.log('CLASSMIND - Generate NHYD Summaries')
  console.log('='.repeat(60))

  // Get NHYD subjects
  const subjects = await prisma.subject.findMany({
    where: { programId: 'nhyd' }
  })

  console.log(`\nSubjects: ${subjects.length}\n`)

  let totalLessons = 0
  let totalSlides = 0
  let totalSummaries = 0
  let totalErrors = 0

  for (const subject of subjects) {
    // Filter by subject if specified
    if (subjectFilter && !subject.id.includes(subjectFilter)) continue

    console.log(`\n📚 ${subject.name}`)

    // Get lessons with content
    const lessons = await prisma.lesson.findMany({
      where: { subjectId: subject.id },
      include: {
        slides: {
          orderBy: { order: 'asc' },
          include: {
            transcriptMatches: {
              include: { transcriptChunk: true }
            }
          }
        },
        audioParts: {
          include: {
            transcriptChunks: {
              orderBy: { startTime: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    })

    for (const lesson of lessons) {
      console.log(`\n  ${lesson.title}`)

      // Step 1: Create transcript-slide matches
      const allChunks = lesson.audioParts.flatMap(ap => ap.transcriptChunks)
      const slides = lesson.slides

      if (allChunks.length === 0 || slides.length === 0) {
        console.log(`    ⚠️  No audio or slides`)
        continue
      }

      const totalDuration = allChunks[allChunks.length - 1]?.endTime || 0
      const slideInterval = totalDuration / slides.length

      for (const chunk of allChunks) {
        const slideIndex = Math.min(Math.floor(chunk.startTime / slideInterval), slides.length - 1)
        await prisma.transcriptMatch.upsert({
          where: {
            slideId_transcriptChunkId: {
              slideId: slides[slideIndex].id,
              transcriptChunkId: chunk.id
            }
          },
          create: {
            slideId: slides[slideIndex].id,
            transcriptChunkId: chunk.id,
            confidenceScore: 0.7
          },
          update: {}
        })
      }

      console.log(`    ✓ Matched ${allChunks.length} chunks to ${slides.length} slides`)

      // Step 2: Generate AI summaries
      const allKeyPoints: string[] = []
      let processed = 0

      for (const slide of slides) {
        const ocrText = slide.ocrText || ''
        const transcriptText = slide.transcriptMatches
          .map(m => m.transcriptChunk.text)
          .join(' ')

        if (!ocrText && !transcriptText) continue

        try {
          const summary = await generateSummary(ocrText, transcriptText)

          if (summary && summary.keyPoints.length > 0) {
            allKeyPoints.push(...summary.keyPoints)

            // Create slide-level note
            await prisma.note.upsert({
              where: { id: `${slide.id}-summary` },
              create: {
                id: `${slide.id}-summary`,
                lessonId: lesson.id,
                slideId: slide.id,
                content: `${summary.keyPoints.map(kp => `• ${kp}`).join('\n')}\n\n**Resumen:** ${summary.oneLiner}`
              },
              update: {
                content: `${summary.keyPoints.map(kp => `• ${kp}`).join('\n')}\n\n**Resumen:** ${summary.oneLiner}`
              }
            })
            totalSummaries++
          }
        } catch (e) {
          console.log(`      Error: ${e}`)
          totalErrors++
        }

        processed++
        totalSlides++

        if (processed % 5 === 0) {
          process.stdout.write(`\r    ${processed}/${slides.length}`)
        }

        // Throttle API calls
        await new Promise(r => setTimeout(r, 150))
      }

      if (processed > 0) {
        console.log(`\r    ✓ ${processed}/${slides.length} slides summarized`)
      }

      // Create lesson-level summary
      if (allKeyPoints.length > 0) {
        const unique = [...new Set(allKeyPoints)].slice(0, 10)
        await prisma.summary.upsert({
          where: { lessonId: lesson.id },
          create: {
            lessonId: lesson.id,
            content: unique.map(k => `• ${k}`).join('\n'),
            keyPoints: unique
          },
          update: {
            content: unique.map(k => `• ${k}`).join('\n'),
            keyPoints: unique
          }
        })

        // Update lesson status
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: { status: 'READY', isProcessed: true }
        })

        console.log(`    ✓ Lesson summary created`)
      }

      totalLessons++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   - Lessons processed: ${totalLessons}`)
  console.log(`   - Slides summarized: ${totalSlides}`)
  console.log(`   - Summaries created: ${totalSummaries}`)
  console.log(`   - Errors: ${totalErrors}`)
  console.log('='.repeat(60))
  console.log('\n✨ NHYD summaries generation complete!')
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
