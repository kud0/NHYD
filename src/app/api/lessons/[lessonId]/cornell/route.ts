import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params

  const note = await prisma.note.findFirst({
    where: {
      id: `${lessonId}-cornell-full`,
      lessonId: lessonId
    }
  })

  // Fallback to the shorter cornell notes if full doesn't exist
  if (!note) {
    const shortNote = await prisma.note.findFirst({
      where: {
        id: `${lessonId}-cornell`,
        lessonId: lessonId
      }
    })

    if (!shortNote) {
      return NextResponse.json({ error: 'Cornell notes not found' }, { status: 404 })
    }

    return NextResponse.json({ content: shortNote.content })
  }

  return NextResponse.json({ content: note.content })
}
