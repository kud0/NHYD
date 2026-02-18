import { prisma } from '../lib/db'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

async function generateForLesson(lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: { contains: lessonId } },
    include: {
      subject: true,
      slides: { orderBy: { order: 'asc' } },
      audioParts: {
        include: { transcriptChunks: { orderBy: { startTime: 'asc' } } }
      }
    }
  })

  if (!lesson) {
    console.log('Not found:', lessonId)
    return false
  }

  const slidesContent = lesson.slides
    .map((s: any, i: number) => `Slide ${i + 1}: ${s.ocrText || ''}`)
    .filter((s: string) => s.length > 15)
    .slice(0, 10)
    .join('\n')
    .slice(0, 2000)

  const transcriptContent = lesson.audioParts
    .flatMap((ap: any) => ap.transcriptChunks)
    .map((c: any) => c.text)
    .join(' ')
    .slice(0, 8000)

  const prompt = `Genera CORNELL NOTES completo en español para esta lección universitaria:

ASIGNATURA: ${lesson.subject.name}
TEMA: ${lesson.title}

DIAPOSITIVAS:
${slidesContent}

TRANSCRIPCIÓN:
${transcriptContent}

FORMATO REQUERIDO:
# CORNELL NOTES: ${lesson.title}

## 📋 INFORMACIÓN DE LA LECCIÓN

## 📝 COLUMNA DE PREGUNTAS CLAVE
(12-15 preguntas SIN respuestas)

## 📖 NOTAS PRINCIPALES
(Secciones numeradas con subtemas)

## 🔑 CONCEPTOS Y DEFINICIONES CLAVE
| Término | Definición |
|---------|------------|

## ⚡ RESUMEN
(4-5 párrafos)

## ✅ AUTOEVALUACIÓN
(P1-P6 con respuestas)

## 🔗 CONEXIONES

Sé detallado y completo.`

  console.log(`Generating: ${lesson.subject.name} - ${lesson.title}`)
  console.log(`Prompt length: ${prompt.length} chars`)

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })

    if (res.ok) {
      const data = await res.json()
      const content = data.response?.trim()
      if (content && content.length > 1000) {
        await prisma.note.upsert({
          where: { id: `${lesson.id}-cornell-full` },
          create: { id: `${lesson.id}-cornell-full`, lessonId: lesson.id, content },
          update: { content }
        })
        console.log(`  ✓ Generated: ${content.length} chars`)
        return true
      }
      console.log(`  ✗ Content too short: ${content?.length || 0}`)
      return false
    }
    console.log(`  ✗ Request failed: ${res.status}`)
    return false
  } catch (e) {
    console.log(`  ✗ Error:`, e)
    return false
  }
}

async function main() {
  const failed = ['t6-sistema-nervioso-organizacion', 't3-tejidos-y-fisiologia', 't4-identidad-genero']
  for (const id of failed) {
    await generateForLesson(id)
    await new Promise(r => setTimeout(r, 3000))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
