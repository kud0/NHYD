import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type RouteContext = {
  params: Promise<{ lessonId: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { lessonId } = await context.params

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        audioParts: {
          orderBy: { order: 'asc' },
          include: {
            transcriptChunks: {
              orderBy: { startTime: 'asc' },
              select: {
                id: true,
                text: true,
                startTime: true,
                endTime: true,
              },
            },
          },
        },
        slides: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            imagePath: true,
            ocrText: true,
          },
        },
        summary: {
          select: {
            content: true,
            keyPoints: true,
          },
        },
        quizzes: {
          select: {
            id: true,
            title: true,
            questionCount: true,
          },
          orderBy: { generatedAt: 'desc' },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(lesson)
  } catch (error) {
    console.error('Error fetching lesson:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lesson' },
      { status: 500 }
    )
  }
}
