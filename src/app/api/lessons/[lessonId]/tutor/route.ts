import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

// GET - Fetch saved tutor questions for a lesson
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params

  const questions = await prisma.tutorQuestion.findMany({
    where: { lessonId },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(questions)
}

// POST - Ask a new question
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params
  const body = await request.json()
  const { selectedText, question } = body

  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  // Get lesson content (transcript + slides OCR)
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      slides: { select: { ocrText: true }, orderBy: { order: 'asc' } },
      audioParts: {
        include: {
          transcriptChunks: {
            select: { text: true },
            orderBy: { startTime: 'asc' }
          }
        }
      }
    }
  })

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  // Build lesson context
  const slidesContent = lesson.slides
    .map(s => s.ocrText)
    .filter(Boolean)
    .join('\n')

  const transcriptContent = lesson.audioParts
    .flatMap(ap => ap.transcriptChunks)
    .map(c => c.text)
    .join(' ')

  const lessonContext = `
CONTENIDO DE LAS DIAPOSITIVAS:
${slidesContent.slice(0, 5000)}

TRANSCRIPCIÓN DEL PROFESOR:
${transcriptContent.slice(0, 15000)}
`.trim()

  // Build the prompt
  const prompt = `Eres un tutor de la asignatura "${lesson.title}".

REGLAS ESTRICTAS:
1. SOLO puedes responder usando la información del contenido de la lección que te proporciono abajo.
2. NO uses conocimiento general o externo.
3. Si la pregunta no puede responderse con el contenido de la lección, di: "Esta pregunta no está cubierta en el contenido de esta lección."
4. Cita partes específicas del contenido cuando sea posible.
5. Responde en español, de forma clara y educativa.

${lessonContext}

---

${selectedText ? `TEXTO SELECCIONADO POR EL ESTUDIANTE:
"${selectedText}"

` : ''}PREGUNTA DEL ESTUDIANTE:
${question}

RESPUESTA (basada ÚNICAMENTE en el contenido de la lección):`

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })

    if (!res.ok) {
      throw new Error('AI service error')
    }

    const data = await res.json()
    const answer = data.response?.trim() || 'No se pudo generar una respuesta.'

    // Save to database
    const tutorQuestion = await prisma.tutorQuestion.create({
      data: {
        lessonId,
        selectedText: selectedText || '',
        question,
        answer
      }
    })

    return NextResponse.json(tutorQuestion)
  } catch (error) {
    console.error('Tutor error:', error)
    return NextResponse.json(
      { error: 'Failed to get answer from AI' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a saved question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { searchParams } = new URL(request.url)
  const questionId = searchParams.get('id')

  if (!questionId) {
    return NextResponse.json({ error: 'Question ID required' }, { status: 400 })
  }

  await prisma.tutorQuestion.delete({
    where: { id: questionId }
  })

  return NextResponse.json({ success: true })
}
