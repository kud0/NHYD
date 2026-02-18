import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Fetch all annotations for a lesson
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params

    const annotations = await prisma.annotation.findMany({
      where: { lessonId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(annotations)
  } catch (error) {
    console.error('Error fetching annotations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch annotations' },
      { status: 500 }
    )
  }
}

// POST - Create a new annotation (highlight or sticky note)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params
    const body = await request.json()

    const { type, color, selectedText, noteContent, position } = body

    if (!type || !color) {
      return NextResponse.json(
        { error: 'Type and color are required' },
        { status: 400 }
      )
    }

    if (type === 'HIGHLIGHT' && !selectedText) {
      return NextResponse.json(
        { error: 'Selected text is required for highlights' },
        { status: 400 }
      )
    }

    if (type === 'STICKY_NOTE' && !noteContent) {
      return NextResponse.json(
        { error: 'Note content is required for sticky notes' },
        { status: 400 }
      )
    }

    const annotation = await prisma.annotation.create({
      data: {
        type,
        color,
        selectedText,
        noteContent,
        position,
        lessonId
      }
    })

    return NextResponse.json(annotation, { status: 201 })
  } catch (error) {
    console.error('Error creating annotation:', error)
    return NextResponse.json(
      { error: 'Failed to create annotation' },
      { status: 500 }
    )
  }
}

// DELETE - Remove an annotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const annotationId = searchParams.get('id')

    if (!annotationId) {
      return NextResponse.json(
        { error: 'Annotation ID is required' },
        { status: 400 }
      )
    }

    await prisma.annotation.delete({
      where: { id: annotationId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting annotation:', error)
    return NextResponse.json(
      { error: 'Failed to delete annotation' },
      { status: 500 }
    )
  }
}
