import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/subjects - List all subjects
export async function GET() {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { lessons: true }
        },
        lessons: {
          select: {
            id: true,
            status: true,
            _count: {
              select: { flashcards: true }
            }
          }
        }
      }
    })

    // Calculate stats for each subject
    const subjectsWithStats = subjects.map(subject => ({
      ...subject,
      lessonCount: subject._count.lessons,
      readyLessons: subject.lessons.filter(l => l.status === 'READY').length,
      totalFlashcards: subject.lessons.reduce((sum, l) => sum + l._count.flashcards, 0),
      lessons: undefined, // Remove lessons array from response
      _count: undefined,
    }))

    return NextResponse.json(subjectsWithStats)
  } catch (error) {
    console.error('Error fetching subjects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subjects' },
      { status: 500 }
    )
  }
}

// POST /api/subjects - Create a new subject
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, semester, color, icon } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Get max order
    const maxOrder = await prisma.subject.aggregate({
      _max: { order: true }
    })

    const subject = await prisma.subject.create({
      data: {
        name,
        description: description || null,
        semester: semester || 1,
        color: color || '#3B82F6',
        icon: icon || null,
        order: (maxOrder._max.order || 0) + 1,
      }
    })

    return NextResponse.json(subject, { status: 201 })
  } catch (error) {
    console.error('Error creating subject:', error)
    return NextResponse.json(
      { error: 'Failed to create subject' },
      { status: 500 }
    )
  }
}
