import { prisma } from '../lib/db'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

async function callAI(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.response?.trim() || null
  } catch {
    return null
  }
}

async function generateCornellMultipart(lesson: any): Promise<string | null> {
  const slidesContent = lesson.slides
    .map((s: any, i: number) => `SLIDE ${i + 1}:\n${s.ocrText || ''}`)
    .filter((s: string) => s.length > 15)
    .join('\n\n')

  const transcriptContent = lesson.audioParts
    .flatMap((ap: any) => ap.transcriptChunks)
    .map((c: any) => c.text)
    .join(' ')

  if (!transcriptContent || transcriptContent.length < 100) {
    return null
  }

  const lessonInfo = `LECCIÓN: ${lesson.title}\nASIGNATURA: ${lesson.subject.name}`

  // Split transcript into chunks for multiple calls
  const chunk1 = transcriptContent.slice(0, 12000)
  const chunk2 = transcriptContent.slice(12000, 24000)
  const chunk3 = transcriptContent.slice(24000, 36000)
  const slides = slidesContent.slice(0, 5000)

  // PART 1: Core notes from first part of transcript
  console.log('    Part 1: Core notes...')
  const part1Prompt = `Eres un experto en metodología Cornell Notes. Analiza este contenido de clase universitaria.

${lessonInfo}

DIAPOSITIVAS:
${slides}

TRANSCRIPCIÓN (Parte 1):
${chunk1}

---

Genera las NOTAS PRINCIPALES detalladas (secciones con títulos, explicaciones completas, citas del profesor).
Estructura cada tema con:
- Título del tema
- Explicación detallada
- Puntos clave en negrita
- Citas textuales del profesor en cursiva
- Tablas cuando sea apropiado

Escribe en español. Sé MUY detallado (mínimo 5000 caracteres).`

  const part1 = await callAI(part1Prompt)
  if (!part1) {
    console.log('    Part 1 failed')
    return null
  }
  console.log(`    Part 1: ${part1.length} chars`)

  // PART 2: Additional notes from second part (if exists)
  let part2 = ''
  if (chunk2.length > 500) {
    console.log('    Part 2: Additional notes...')
    const part2Prompt = `Continúa analizando esta clase universitaria.

${lessonInfo}

TRANSCRIPCIÓN (Parte 2):
${chunk2}

---

Genera NOTAS ADICIONALES sobre los temas nuevos que aparecen en esta parte.
Misma estructura: títulos, explicaciones detalladas, puntos clave, citas del profesor.
NO repitas temas de la parte anterior.

Escribe en español. Sé detallado.`

    part2 = await callAI(part2Prompt) || ''
    console.log(`    Part 2: ${part2.length} chars`)
  }

  // PART 3: More content if transcript is very long
  let part3 = ''
  if (chunk3.length > 500) {
    console.log('    Part 3: More content...')
    const part3Prompt = `Continúa analizando esta clase universitaria.

${lessonInfo}

TRANSCRIPCIÓN (Parte 3):
${chunk3}

---

Genera NOTAS ADICIONALES sobre los temas nuevos.
NO repitas temas anteriores.

Escribe en español.`

    part3 = await callAI(part3Prompt) || ''
    console.log(`    Part 3: ${part3.length} chars`)
  }

  // PART 4: Questions, concepts, summary
  console.log('    Part 4: Questions, concepts, summary...')
  const part4Prompt = `Basándote en este contenido de clase:

${lessonInfo}

RESUMEN DE TEMAS CUBIERTOS:
${part1.slice(0, 4000)}

TRANSCRIPCIÓN:
${chunk1.slice(0, 6000)}

---

Genera:

## PREGUNTAS CLAVE (12-15 preguntas de autoevaluación SIN respuestas)
1. ¿...?
[continúa]

## CONCEPTOS Y DEFINICIONES CLAVE
| Término | Definición |
|---------|------------|
[10-15 términos importantes]

## RESUMEN (4-5 párrafos completos que sinteticen TODA la lección)
[Usa **negrita** para términos clave]

Escribe en español. Sé completo.`

  const part4 = await callAI(part4Prompt)
  if (!part4) {
    console.log('    Part 4 failed')
    return null
  }
  console.log(`    Part 4: ${part4.length} chars`)

  // PART 5: Self-evaluation and connections
  console.log('    Part 5: Self-evaluation...')
  const part5Prompt = `Para esta lección universitaria:

${lessonInfo}

TEMAS PRINCIPALES:
${part1.slice(0, 3000)}

---

Genera:

## AUTOEVALUACIÓN (6 preguntas CON respuestas detalladas)

**P1:** [Pregunta de aplicación práctica]
**R:** [Respuesta completa]

---

**P2:** [Pregunta sobre un caso real]
**R:** [Respuesta completa]

---

[Continúa hasta P6]

## CONEXIONES

### Con temas anteriores:
- [Concepto]: cómo se relaciona

### Aplicaciones prácticas:
- [Aplicación real en la profesión]

## NOTAS ADICIONALES DEL PROFESOR
> *"[Cita importante]"*

Escribe en español.`

  const part5 = await callAI(part5Prompt)
  if (!part5) {
    console.log('    Part 5 failed')
    return null
  }
  console.log(`    Part 5: ${part5.length} chars`)

  // COMBINE ALL PARTS
  const fullNotes = `# CORNELL NOTES: ${lesson.title}

## INFORMACIÓN DE LA LECCIÓN
- **Asignatura:** ${lesson.subject.name}
- **Tema:** ${lesson.title}

---

## NOTAS PRINCIPALES

${part1}

${part2 ? `\n---\n\n### CONTENIDO ADICIONAL\n\n${part2}` : ''}

${part3 ? `\n---\n\n### MÁS CONTENIDO\n\n${part3}` : ''}

---

${part4}

---

${part5}

---

*Cornell Notes generado automáticamente*`

  return fullNotes
}

async function main() {
  console.log('='.repeat(60))
  console.log('CLASSMIND - Generate Full Cornell Notes (MULTIPART)')
  console.log('='.repeat(60))

  const lessons = await prisma.lesson.findMany({
    include: {
      subject: true,
      slides: { orderBy: { order: 'asc' } },
      audioParts: {
        include: { transcriptChunks: { orderBy: { startTime: 'asc' } } }
      }
    },
    orderBy: [{ subject: { name: 'asc' } }, { order: 'asc' }]
  })

  console.log(`\nFound ${lessons.length} lessons\n`)

  let generated = 0
  let skipped = 0
  let failed = 0

  for (const lesson of lessons) {
    const hasTranscript = lesson.audioParts.some(ap => ap.transcriptChunks.length > 0)

    if (!hasTranscript) {
      console.log(`⚠️  ${lesson.subject.name} - ${lesson.title}: No transcript`)
      skipped++
      continue
    }

    const existing = await prisma.note.findFirst({
      where: { id: `${lesson.id}-cornell-full` }
    })

    if (existing && existing.content.length > 5000 && !existing.content.includes('Invalid')) {
      console.log(`✓  ${lesson.subject.name} - ${lesson.title}: Already exists`)
      skipped++
      continue
    }

    console.log(`📝 ${lesson.subject.name} - ${lesson.title}...`)

    const content = await generateCornellMultipart(lesson)

    if (content && content.length > 3000) {
      await prisma.note.upsert({
        where: { id: `${lesson.id}-cornell-full` },
        create: {
          id: `${lesson.id}-cornell-full`,
          lessonId: lesson.id,
          content
        },
        update: { content }
      })
      console.log(`   ✓ Generated (${content.length} chars)`)
      generated++
    } else {
      console.log(`   ✗ Failed`)
      failed++
    }

    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Done! Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`)
  console.log('='.repeat(60))
}

main().catch(console.error).finally(() => prisma.$disconnect())
