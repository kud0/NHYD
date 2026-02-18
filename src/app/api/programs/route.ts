import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Fetch all programs with subject counts
export async function GET() {
  try {
    const programs = await prisma.program.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { subjects: true }
        },
        subjects: {
          select: {
            id: true,
            _count: {
              select: { lessons: true }
            }
          }
        }
      }
    })

    // Calculate total lessons per program
    const programsWithStats = programs.map(program => ({
      id: program.id,
      name: program.name,
      fullName: program.fullName,
      description: program.description,
      color: program.color,
      icon: program.icon,
      order: program.order,
      subjectCount: program._count.subjects,
      lessonCount: program.subjects.reduce((acc, s) => acc + s._count.lessons, 0)
    }))

    return NextResponse.json(programsWithStats)
  } catch (error) {
    console.error('Error fetching programs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch programs' },
      { status: 500 }
    )
  }
}

// POST - Create a new program
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, fullName, description, color, icon } = body

    if (!name || !fullName) {
      return NextResponse.json(
        { error: 'Name and fullName are required' },
        { status: 400 }
      )
    }

    // Get max order
    const maxOrder = await prisma.program.aggregate({
      _max: { order: true }
    })

    const program = await prisma.program.create({
      data: {
        name,
        fullName,
        description,
        color: color || '#3B82F6',
        icon,
        order: (maxOrder._max.order || 0) + 1
      }
    })

    return NextResponse.json(program, { status: 201 })
  } catch (error) {
    console.error('Error creating program:', error)
    return NextResponse.json(
      { error: 'Failed to create program' },
      { status: 500 }
    )
  }
}
