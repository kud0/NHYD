import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type RouteContext = {
  params: Promise<{ lessonId: string }>
}

/**
 * GET /api/lessons/[lessonId]/slides
 * Returns slides with their matched transcript chunks
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { lessonId } = await context.params

    const slides = await prisma.slide.findMany({
      where: { lessonId },
      orderBy: { order: 'asc' },
      include: {
        transcriptMatches: {
          include: {
            transcriptChunk: {
              select: {
                id: true,
                text: true,
                startTime: true,
                endTime: true,
              },
            },
          },
          orderBy: {
            transcriptChunk: {
              startTime: 'asc',
            },
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    // Transform to include transcript text for each slide
    const slidesWithTranscript = slides.map(slide => {
      const chunks = slide.transcriptMatches.map(m => m.transcriptChunk)
      const transcriptText = chunks.map(c => c.text).join(' ')

      return {
        id: slide.id,
        order: slide.order,
        imagePath: slide.imagePath,
        ocrText: slide.ocrText,
        note: slide.notes[0]?.content || null,
        transcript: {
          text: transcriptText,
          chunks: chunks,
          startTime: chunks[0]?.startTime || 0,
          endTime: chunks[chunks.length - 1]?.endTime || 0,
        },
      }
    })

    return NextResponse.json(slidesWithTranscript)
  } catch (error) {
    console.error('Error fetching slides:', error)
    return NextResponse.json(
      { error: 'Failed to fetch slides' },
      { status: 500 }
    )
  }
}
