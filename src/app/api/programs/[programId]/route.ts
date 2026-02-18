import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Fetch a single program with its subjects
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params

    const program = await prisma.program.findUnique({
      where: { id: programId },
      include: {
        subjects: {
          orderBy: [
            { semester: 'asc' },
            { order: 'asc' }
          ],
          include: {
            _count: {
              select: { lessons: true }
            },
            lessons: {
              select: {
                id: true,
                status: true,
                totalDuration: true
              }
            }
          }
        }
      }
    })

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      )
    }

    // Group subjects by semester/parcial
    const subjectsBySemester: Record<number, typeof program.subjects> = {}
    program.subjects.forEach(subject => {
      const sem = subject.semester
      if (!subjectsBySemester[sem]) {
        subjectsBySemester[sem] = []
      }
      subjectsBySemester[sem].push(subject)
    })

    // Calculate stats for each subject
    const subjectsWithStats = program.subjects.map(subject => ({
      ...subject,
      lessonCount: subject._count.lessons,
      readyLessons: subject.lessons.filter(l => l.status === 'READY').length,
      totalDuration: subject.lessons.reduce((acc, l) => acc + (l.totalDuration || 0), 0)
    }))

    return NextResponse.json({
      ...program,
      subjects: subjectsWithStats,
      subjectsBySemester
    })
  } catch (error) {
    console.error('Error fetching program:', error)
    return NextResponse.json(
      { error: 'Failed to fetch program' },
      { status: 500 }
    )
  }
}
