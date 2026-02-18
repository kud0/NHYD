import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type RouteContext = {
  params: Promise<{ subjectId: string }>
}

// GET /api/subjects/[subjectId]/lessons - List lessons for a subject
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { subjectId } = await context.params

    const lessons = await prisma.lesson.findMany({
      where: { subjectId },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            slides: true,
            flashcards: true,
            notes: true,
          }
        }
      }
    })

    const lessonsWithStats = lessons.map(lesson => ({
      ...lesson,
      slideCount: lesson._count.slides,
      flashcardCount: lesson._count.flashcards,
      noteCount: lesson._count.notes,
      _count: undefined,
    }))

    return NextResponse.json(lessonsWithStats)
  } catch (error) {
    console.error('Error fetching lessons:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lessons' },
      { status: 500 }
    )
  }
}

// POST /api/subjects/[subjectId]/lessons - Create a new lesson
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { subjectId } = await context.params
    const body = await request.json()
    const { title, description } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId }
    })

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject not found' },
        { status: 404 }
      )
    }

    // Get max order for this subject
    const maxOrder = await prisma.lesson.aggregate({
      where: { subjectId },
      _max: { order: true }
    })

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description: description || null,
        order: (maxOrder._max.order || 0) + 1,
        subjectId,
        status: 'PENDING',
      }
    })

    return NextResponse.json(lesson, { status: 201 })
  } catch (error) {
    console.error('Error creating lesson:', error)
    return NextResponse.json(
      { error: 'Failed to create lesson' },
      { status: 500 }
    )
  }
}
