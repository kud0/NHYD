#!/usr/bin/env npx tsx
/**
 * ClassMind - Knowledge Base Indexer
 * Indexes all existing content for RAG search
 *
 * Usage: npx tsx scripts/index-knowledge.ts [--type transcript|slide|cornell|summary]
 */

import { prisma } from '../lib/db'
import { indexContent, getIndexStats } from '../lib/knowledge'

interface IndexOptions {
  type?: 'transcript' | 'slide' | 'cornell' | 'summary' | 'all'
  limit?: number
}

async function indexTranscripts(limit?: number) {
  console.log('\n📝 Indexing transcripts...')

  const transcripts = await prisma.transcriptChunk.findMany({
    take: limit,
    include: {
      audioPart: {
        include: {
          lesson: {
            include: {
              subject: true,
            },
          },
        },
      },
    },
  })

  let indexed = 0
  for (const t of transcripts) {
    if (!t.text || t.text.length < 50) continue

    const lesson = t.audioPart.lesson
    const subject = lesson.subject

    try {
      await indexContent(t.text, {
        sourceType: 'transcript',
        sourceId: t.id,
        lessonId: lesson.id,
        subjectId: subject?.id,
        programId: subject?.programId || undefined,
        title: `${lesson.title} - ${t.audioPart.title}`,
        tags: ['transcript', subject?.name || ''].filter(Boolean),
      })
      indexed++
      process.stdout.write(`\r   Indexed ${indexed}/${transcripts.length} transcripts`)
    } catch (error) {
      console.error(`\n   ✗ Failed to index transcript ${t.id}:`, error)
    }
  }
  console.log(`\n   ✓ Indexed ${indexed} transcripts`)
  return indexed
}

async function indexSlides(limit?: number) {
  console.log('\n🖼️  Indexing slide OCR...')

  const slides = await prisma.slide.findMany({
    take: limit,
    where: {
      ocrText: { not: null },
    },
    include: {
      lesson: {
        include: {
          subject: true,
        },
      },
    },
  })

  let indexed = 0
  for (const s of slides) {
    if (!s.ocrText || s.ocrText.length < 30) continue

    const lesson = s.lesson
    const subject = lesson.subject

    try {
      await indexContent(s.ocrText, {
        sourceType: 'slide',
        sourceId: s.id,
        lessonId: lesson.id,
        subjectId: subject?.id,
        programId: subject?.programId || undefined,
        title: `${lesson.title} - Slide ${s.order}`,
        tags: ['slide', 'ocr', subject?.name || ''].filter(Boolean),
      })
      indexed++
      process.stdout.write(`\r   Indexed ${indexed}/${slides.length} slides`)
    } catch (error) {
      console.error(`\n   ✗ Failed to index slide ${s.id}:`, error)
    }
  }
  console.log(`\n   ✓ Indexed ${indexed} slides`)
  return indexed
}

async function indexCornellNotes(limit?: number) {
  console.log('\n📒 Indexing Cornell notes...')

  // Cornell notes are stored as Notes with special content
  const notes = await prisma.note.findMany({
    take: limit,
    where: {
      content: { startsWith: '# ' }, // Cornell notes start with markdown header
      slideId: null, // Cornell notes are lesson-level, not slide-specific
    },
    include: {
      lesson: {
        include: {
          subject: true,
        },
      },
    },
  })

  let indexed = 0
  for (const n of notes) {
    if (!n.content || n.content.length < 100) continue

    const lesson = n.lesson
    const subject = lesson.subject

    try {
      await indexContent(n.content, {
        sourceType: 'cornell',
        sourceId: n.id,
        lessonId: lesson.id,
        subjectId: subject?.id,
        programId: subject?.programId || undefined,
        title: `Cornell: ${lesson.title}`,
        tags: ['cornell', 'notes', subject?.name || ''].filter(Boolean),
      })
      indexed++
      process.stdout.write(`\r   Indexed ${indexed}/${notes.length} Cornell notes`)
    } catch (error) {
      console.error(`\n   ✗ Failed to index Cornell note ${n.id}:`, error)
    }
  }
  console.log(`\n   ✓ Indexed ${indexed} Cornell notes`)
  return indexed
}

async function indexSummaries(limit?: number) {
  console.log('\n📋 Indexing summaries...')

  const summaries = await prisma.summary.findMany({
    take: limit,
    include: {
      lesson: {
        include: {
          subject: true,
        },
      },
    },
  })

  let indexed = 0
  for (const s of summaries) {
    if (!s.content || s.content.length < 50) continue

    const lesson = s.lesson
    const subject = lesson.subject

    // Combine content with key points
    const fullContent = `${s.content}\n\nPuntos clave:\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`

    try {
      await indexContent(fullContent, {
        sourceType: 'summary',
        sourceId: s.id,
        lessonId: lesson.id,
        subjectId: subject?.id,
        programId: subject?.programId || undefined,
        title: `Resumen: ${lesson.title}`,
        tags: ['summary', 'resumen', subject?.name || ''].filter(Boolean),
      })
      indexed++
      process.stdout.write(`\r   Indexed ${indexed}/${summaries.length} summaries`)
    } catch (error) {
      console.error(`\n   ✗ Failed to index summary ${s.id}:`, error)
    }
  }
  console.log(`\n   ✓ Indexed ${indexed} summaries`)
  return indexed
}

async function main() {
  const args = process.argv.slice(2)
  const typeIndex = args.indexOf('--type')
  const limitIndex = args.indexOf('--limit')

  const options: IndexOptions = {
    type: (typeIndex >= 0 ? args[typeIndex + 1] : 'cornell') as IndexOptions['type'],  // Default to cornell, not all
    limit: limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined,
  }

  console.log('============================================================')
  console.log('CLASSMIND - Knowledge Base Indexer')
  console.log('============================================================')
  console.log(`Type: ${options.type || 'all'}`)
  console.log(`Limit: ${options.limit || 'none'}`)

  const totals: Record<string, number> = {}

  try {
    if (options.type === 'all' || options.type === 'transcript') {
      totals.transcripts = await indexTranscripts(options.limit)
    }

    if (options.type === 'all' || options.type === 'slide') {
      totals.slides = await indexSlides(options.limit)
    }

    if (options.type === 'all' || options.type === 'cornell') {
      totals.cornell = await indexCornellNotes(options.limit)
    }

    if (options.type === 'all' || options.type === 'summary') {
      totals.summaries = await indexSummaries(options.limit)
    }

    // Print final stats
    console.log('\n============================================================')
    console.log('Indexing Complete!')
    console.log('============================================================')
    console.log('Indexed:')
    Object.entries(totals).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })

    const stats = await getIndexStats()
    console.log(`\nTotal chunks in knowledge base: ${stats.totalChunks}`)
  } catch (error) {
    console.error('Indexing failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
