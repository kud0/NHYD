import { prisma } from '../lib/db'

const N8N_WEBHOOK = 'http://127.0.0.1:5678/webhook/classmind-ai'

async function generateCornellNotes(lesson: any): Promise<string | null> {
  // Get all slide OCR text
  const slidesContent = lesson.slides
    .map((s: any, i: number) => `SLIDE ${i + 1}:\n${s.ocrText || ''}`)
    .filter((s: string) => s.length > 15)
    .join('\n\n')

  // Get full transcript
  const transcriptContent = lesson.audioParts
    .flatMap((ap: any) => ap.transcriptChunks)
    .map((c: any) => c.text)
    .join(' ')

  if (!transcriptContent || transcriptContent.length < 100) {
    return null
  }

  const prompt = `Eres un experto en la metodología Cornell Notes. Crea un documento de estudio COMPLETO, AUTÓNOMO y MUY DETALLADO para esta lección universitaria.

LECCIÓN: ${lesson.title}
ASIGNATURA: ${lesson.subject.name}

CONTENIDO DE LAS DIAPOSITIVAS:
${slidesContent.slice(0, 8000)}

TRANSCRIPCIÓN DEL PROFESOR:
${transcriptContent.slice(0, 20000)}

---

Genera un documento de CORNELL NOTES completo siguiendo EXACTAMENTE esta estructura:

# CORNELL NOTES: ${lesson.title}

## 📋 INFORMACIÓN DE LA LECCIÓN
- **Asignatura:** ${lesson.subject.name}
- **Tema:** ${lesson.title}
- **Duración aproximada:** [estima basándote en el contenido]
- **Nivel de dificultad:** [Básico/Medio/Alto]

---

## 📝 COLUMNA DE PREGUNTAS CLAVE

[IMPORTANTE: Solo preguntas SIN respuestas - son para autoevaluación del estudiante]

1. ¿...?
2. ¿...?
3. ¿...?
[Incluye 12-15 preguntas clave que cubran todo el contenido]

---

## 📖 NOTAS PRINCIPALES

### 1. [Primer Tema Principal]

[Contenido detallado con:]
- **Puntos importantes en negrita**
- *Citas del profesor en cursiva: "..."*
- Listas con viñetas
- Tablas cuando sea apropiado:

| Columna 1 | Columna 2 |
|-----------|-----------|
| dato | dato |

#### Subtema A
[Detalles]

#### Subtema B
[Detalles]

---

### 2. [Segundo Tema Principal]

[Misma estructura: explicación detallada, puntos clave, citas del profesor, tablas]

---

### 3. [Tercer Tema Principal]

[Continúa con todos los temas de la lección]

---

## 🔑 CONCEPTOS Y DEFINICIONES CLAVE

| Término | Definición |
|---------|------------|
| **Concepto 1** | Definición clara y concisa |
| **Concepto 2** | Definición clara y concisa |
[Incluye 10-15 términos importantes]

---

## 📊 DIAGRAMAS (TEXTUALES)

\`\`\`
[Diagrama 1: Representa visualmente un proceso o concepto clave]
Ejemplo de diagrama de flujo:
    Paso 1 → Paso 2 → Paso 3
       ↓         ↓         ↓
    Resultado  Resultado  Resultado
\`\`\`

\`\`\`
[Diagrama 2: Otro proceso o estructura importante]
\`\`\`

---

## ⚡ RESUMEN

[Escribe 4-5 párrafos que sinteticen TODA la lección de forma completa. Cada párrafo debe cubrir un aspecto diferente del tema. Usa **negrita** para términos clave. Este resumen debe permitir entender la lección completa sin necesidad de ver las notas principales.]

---

## ✅ AUTOEVALUACIÓN

**P1:** [Pregunta de aplicación/comprensión]
**R:** [Respuesta detallada]

---

**P2:** [Pregunta sobre un caso práctico]
**R:** [Respuesta detallada]

---

**P3:** [Pregunta que relaciona conceptos]
**R:** [Respuesta detallada]

---

**P4:** [Pregunta de análisis]
**R:** [Respuesta detallada]

---

**P5:** [Pregunta integradora]
**R:** [Respuesta detallada]

---

**P6:** [Pregunta adicional]
**R:** [Respuesta detallada]

---

## 🔗 CONEXIONES

### Con temas anteriores:
- [Concepto previo 1]: Cómo se relaciona
- [Concepto previo 2]: Cómo se relaciona

### Con temas futuros (mencionados por el profesor):
- [Tema futuro 1]: Por qué es relevante
- [Tema futuro 2]: Por qué es relevante

### Aplicaciones prácticas:
- [Aplicación 1]: Cómo se usa en la vida real/profesión
- [Aplicación 2]: Cómo se usa en la vida real/profesión

---

## 📚 NOTAS ADICIONALES DEL PROFESOR

> *"[Cita textual importante del profesor]"*

> *"[Otra cita o consejo del profesor]"*

**Consejos de estudio mencionados:**
- [Consejo 1]
- [Consejo 2]

---

*Documento generado siguiendo la metodología Cornell Notes para estudio autónomo.*

IMPORTANTE:
- Escribe en español
- Sé MUY detallado y completo (mínimo 15000 caracteres)
- Incluye citas textuales del profesor cuando las encuentres en la transcripción
- Las PREGUNTAS CLAVE no deben tener respuestas (son para autoevaluación)
- La AUTOEVALUACIÓN sí debe tener preguntas CON respuestas
- Usa tablas, listas, negrita y formato markdown de forma abundante`

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

async function main() {
  console.log('='.repeat(60))
  console.log('CLASSMIND - Generate Full Cornell Notes')
  console.log('='.repeat(60))

  // Get all lessons with content
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
      console.log(`⚠️  ${lesson.subject.name} - ${lesson.title}: No transcript, skipping`)
      skipped++
      continue
    }

    // Check if already has full cornell notes
    const existing = await prisma.note.findFirst({
      where: { id: `${lesson.id}-cornell-full` }
    })

    if (existing && existing.content.length > 10000 && !existing.content.includes('Invalid')) {
      console.log(`✓  ${lesson.subject.name} - ${lesson.title}: Already exists (${existing.content.length} chars)`)
      skipped++
      continue
    }

    if (existing && existing.content.length <= 10000) {
      console.log(`🔄 ${lesson.subject.name} - ${lesson.title}: Too short (${existing.content.length}), regenerating...`)
    }

    console.log(`📝 ${lesson.subject.name} - ${lesson.title}...`)

    const content = await generateCornellNotes(lesson)

    if (content && content.length > 500) {
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

    // Small delay
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Done! Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`)
  console.log('='.repeat(60))
}

main().catch(console.error).finally(() => prisma.$disconnect())
