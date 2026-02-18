import { prisma } from '../lib/db'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

interface QuizQuestion {
  question: string
  options: string[]
  correct: string
  explanation: string
}

async function generateQuiz(lessonContent: string): Promise<QuizQuestion[] | null> {
  const prompt = `Eres un profesor universitario especializado en entrenamiento personal. Genera 10 preguntas de examen tipo test basadas en este contenido de clase:

${lessonContent}

Responde EXACTAMENTE en formato JSON array (sin explicación adicional):
[
  {
    "question": "¿Pregunta?",
    "options": ["A) Opción 1", "B) Opción 2", "C) Opción 3", "D) Opción 4"],
    "correct": "A) Opción 1",
    "explanation": "Breve explicación de por qué esta es la respuesta correcta"
  },
  ...
]`

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })

    if (!res.ok) return null

    const data = (await res.json()) as any
    const response = data.response?.trim() || ''

    if (!response) return null

    // Try to parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return null

    const questions = JSON.parse(jsonMatch[0]) as QuizQuestion[]
    return questions.length > 0 ? questions : null
  } catch (e) {
    return null
  }
}

async function main() {
  const subjectFilter = process.argv
    .find(arg => arg.startsWith('--subject'))
    ?.split('=')[1]

  console.log('='.repeat(60))
  console.log('CLASSMIND - Generate CPE Quizzes')
  console.log('='.repeat(60))

  // Get CPE subjects
  const subjects = await prisma.subject.findMany({
    where: { programId: 'cpe' }
  })

  let totalQuizzes = 0
  let totalQuestions = 0
  let totalErrors = 0

  for (const subject of subjects) {
    // Filter by subject if specified
    if (subjectFilter && !subject.id.includes(subjectFilter)) continue

    console.log(`\n📚 ${subject.name}`)

    // Get ready lessons
    const lessons = await prisma.lesson.findMany({
      where: {
        subjectId: subject.id,
        status: 'READY'
      },
      include: {
        notes: true,
        summary: true,
        audioParts: {
          include: {
            transcriptChunks: {
              orderBy: { startTime: 'asc' }
            }
          }
        }
      },
      orderBy: { order: 'asc' }
    })

    console.log(`  Found ${lessons.length} ready lessons`)

    for (const lesson of lessons) {
      console.log(`  ${lesson.title}...`)

      // Collect lesson content
      const summaryContent = lesson.summary?.content || ''
      const noteContent = lesson.notes.map(n => n.content).join('\n')
      const transcriptChunks = lesson.audioParts.flatMap(ap => ap.transcriptChunks)
      const transcriptContent = transcriptChunks
        .slice(0, 20) // First 20 chunks
        .map(c => c.text)
        .join(' ')

      const lessonContent = `
Título: ${lesson.title}

Resumen:
${summaryContent}

Notas:
${noteContent}

Contenido del profesor:
${transcriptContent}
`.slice(0, 3000)

      try {
        const questions = await generateQuiz(lessonContent)

        if (questions && questions.length > 0) {
          // Create quiz
          const quiz = await prisma.quiz.create({
            data: {
              title: `Quiz - ${lesson.title}`,
              lessonId: lesson.id,
              questionCount: questions.length,
              timeLimit: 30,
              passThreshold: 70
            }
          })

          // Create questions
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i]
            await prisma.quizQuestion.create({
              data: {
                quizId: quiz.id,
                type: 'MULTIPLE_CHOICE',
                question: q.question,
                options: q.options,
                correct: q.correct,
                explanation: q.explanation,
                order: i
              }
            })
          }

          console.log(`    ✓ Quiz created: ${questions.length} questions`)
          totalQuizzes++
          totalQuestions += questions.length
        } else {
          console.log(`    ⚠️  Failed to generate quiz`)
          totalErrors++
        }
      } catch (e) {
        console.log(`    ✗ Error: ${e}`)
        totalErrors++
      }

      // Throttle API calls
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   - Quizzes created: ${totalQuizzes}`)
  console.log(`   - Questions generated: ${totalQuestions}`)
  console.log(`   - Errors: ${totalErrors}`)
  console.log('='.repeat(60))
  console.log('\n✨ CPE quizzes generation complete!')
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
