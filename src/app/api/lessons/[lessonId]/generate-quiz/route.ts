import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

type RouteContext = {
  params: Promise<{ lessonId: string }>
}

interface GeneratedQuestion {
  question: string
  options: string[]
  correct: string
  explanation: string
}

async function generateQuestions(content: string, count: number): Promise<GeneratedQuestion[]> {
  const prompt = `Eres un profesor universitario de nutrición. Genera ${count} preguntas de examen tipo test basadas en este contenido.

FORMATO (JSON array):
[
  {
    "question": "¿Pregunta aquí?",
    "options": ["A) Opción 1", "B) Opción 2", "C) Opción 3", "D) Opción 4"],
    "correct": "A) Opción 1",
    "explanation": "Breve explicación de por qué es correcta"
  }
]

REGLAS:
- Solo 1 respuesta correcta
- 4 opciones por pregunta
- Preguntas claras y específicas
- Opciones plausibles (no obvias)
- Basadas SOLO en el contenido dado

CONTENIDO:
${content.slice(0, 8000)}

Responde SOLO con el JSON array, sin texto adicional.`

  const res = await fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })

  if (!res.ok) throw new Error('AI generation failed')

  const data = await res.json()
  const response = data.response?.trim() || ''

  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Invalid AI response')

  return JSON.parse(jsonMatch[0])
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { lessonId } = await context.params
    const body = await request.json().catch(() => ({}))
    const questionCount = body.questionCount || 10

    // Get lesson with content
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        slides: {
          include: { notes: { take: 1 } },
          orderBy: { order: 'asc' }
        },
        audioParts: {
          include: {
            transcriptChunks: {
              orderBy: { startTime: 'asc' },
              select: { text: true }
            }
          },
          orderBy: { order: 'asc' }
        },
        summary: true
      }
    })

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // Compile content from slides + transcript
    let content = `Clase: ${lesson.title}\n\n`

    if (lesson.summary) {
      content += `RESUMEN:\n${lesson.summary.keyPoints.join('\n')}\n\n`
    }

    content += `NOTAS:\n`
    for (const slide of lesson.slides) {
      if (slide.notes[0]?.content) {
        content += slide.notes[0].content + '\n'
      }
    }

    content += `\nTRANSCRIPCIÓN:\n`
    for (const audioPart of lesson.audioParts) {
      for (const chunk of audioPart.transcriptChunks) {
        content += chunk.text + ' '
      }
    }

    // Generate questions
    const questions = await generateQuestions(content, questionCount)

    if (questions.length === 0) {
      return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
    }

    // Delete existing quiz for this lesson
    await prisma.quiz.deleteMany({ where: { lessonId } })

    // Create new quiz
    const quiz = await prisma.quiz.create({
      data: {
        title: `Quiz: ${lesson.title}`,
        lessonId: lesson.id,
        timeLimit: 30,
        passThreshold: 50,
        maxAttempts: 999,
        questionCount: questions.length,
        questions: {
          create: questions.map((q, i) => ({
            question: q.question,
            options: q.options,
            correct: q.correct,
            explanation: q.explanation || '',
            order: i
          }))
        }
      }
    })

    return NextResponse.json({
      success: true,
      quizId: quiz.id,
      questionCount: questions.length
    })
  } catch (error) {
    console.error('Error generating quiz:', error)
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    )
  }
}
