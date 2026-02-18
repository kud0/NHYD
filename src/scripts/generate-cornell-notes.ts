import { prisma } from '../lib/db'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

async function generateCornellNotes(lessonTitle: string, transcriptText: string, keyPoints: string[]): Promise<string | null> {
  const prompt = `Eres un experto en técnicas de estudio Cornell Notes. Crea un resumen extenso tipo Cornell para esta lección.

LECCIÓN: ${lessonTitle}

TRANSCRIPCIÓN DEL PROFESOR (fragmentos):
${transcriptText.slice(0, 8000)}

PUNTOS CLAVE IDENTIFICADOS:
${keyPoints.map(k => `• ${k}`).join('\n')}

---

Genera un resumen estilo CORNELL NOTES con estas secciones:

## 📚 RESUMEN DE LA LECCIÓN
[2-3 párrafos explicando el tema principal de forma clara y accesible]

## 🎯 CONCEPTOS CLAVE
[Lista de los 8-10 conceptos más importantes con explicaciones simples]

## 📝 PREGUNTAS DE REPASO
[5-7 preguntas que ayuden a recordar los conceptos]

## 💡 CONEXIONES Y APLICACIONES
[Cómo se relaciona con otros temas y aplicaciones prácticas]

## ⚡ RESUMEN RÁPIDO
[3-5 bullet points con lo más importante para recordar]

Escribe en español, de forma clara y fácil de entender.`

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.response?.trim() || null
  } catch { return null }
}

async function main() {
  const subjectId = process.argv[2]

  if (!subjectId) {
    console.log('Usage: npx tsx scripts/generate-cornell-notes.ts <subjectId>')
    console.log('\nAvailable subjects:')
    const subjects = await prisma.subject.findMany({ select: { id: true, name: true } })
    subjects.forEach(s => console.log(`  ${s.id}: ${s.name}`))
    return
  }

  console.log('='.repeat(60))
  console.log('CLASSMIND - Generate Cornell Notes')
  console.log('='.repeat(60))

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          summary: true,
          audioParts: {
            include: { transcriptChunks: { orderBy: { startTime: 'asc' } } }
          }
        }
      }
    }
  })

  if (!subject) {
    console.log('Subject not found')
    return
  }

  console.log(`\nSubject: ${subject.name}`)
  console.log(`Lessons: ${subject.lessons.length}`)

  for (const lesson of subject.lessons) {
    console.log(`\n📖 ${lesson.title}`)

    // Get all transcript text
    const transcriptText = lesson.audioParts
      .flatMap(ap => ap.transcriptChunks)
      .map(c => c.text)
      .join(' ')

    if (!transcriptText) {
      console.log('   ⚠️ No transcript available, skipping')
      continue
    }

    // Get existing key points from summary
    const keyPoints = lesson.summary?.keyPoints || []

    console.log('   Generating Cornell notes...')
    const cornellNotes = await generateCornellNotes(lesson.title, transcriptText, keyPoints)

    if (cornellNotes) {
      // Store as a special note for the lesson
      await prisma.note.upsert({
        where: { id: `${lesson.id}-cornell` },
        create: {
          id: `${lesson.id}-cornell`,
          lessonId: lesson.id,
          content: cornellNotes,
          slideId: null // Lesson-level note, not tied to a slide
        },
        update: { content: cornellNotes }
      })
      console.log('   ✓ Cornell notes saved')
    } else {
      console.log('   ✗ Failed to generate')
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n' + '='.repeat(60))
  console.log('Done!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
