import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'

const STORAGE_PATH = path.join(process.cwd(), '..', 'storage')

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function main() {
  const subjectPath = path.join(STORAGE_PATH, 'NHYD - 01 Anatomía y Fisiología humana')
  const topics = fs.readdirSync(subjectPath)
    .filter(f => f.startsWith('T') && fs.statSync(path.join(subjectPath, f)).isDirectory())
    .sort()

  console.log('Creating transcript matches...')
  for (const topic of topics) {
    const lessonId = slugify(topic)
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        slides: { orderBy: { order: 'asc' } },
        audioParts: {
          include: { transcriptChunks: { orderBy: { startTime: 'asc' } } },
          orderBy: { order: 'asc' }
        }
      }
    })
    if (!lesson) continue

    const allChunks = lesson.audioParts.flatMap(ap => ap.transcriptChunks)
    const slides = lesson.slides
    if (allChunks.length === 0 || slides.length === 0) continue

    const totalDuration = allChunks[allChunks.length - 1]?.endTime || 0
    const slideInterval = totalDuration / slides.length

    const data = allChunks.map(chunk => {
      const slideIndex = Math.min(Math.floor(chunk.startTime / slideInterval), slides.length - 1)
      return {
        slideId: slides[slideIndex].id,
        transcriptChunkId: chunk.id,
        confidenceScore: 0.7
      }
    })

    await prisma.transcriptMatch.createMany({ data, skipDuplicates: true })
    console.log(`  ${topic}: ${data.length} matches`)
  }
  console.log('Done!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
