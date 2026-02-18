/**
 * Process new Bioquímica audio files:
 * 1. Create lesson records in DB
 * 2. Import transcripts from whisper JSON output
 * 3. Generate Cornell notes via Claude CLI
 */
import { prisma } from '../lib/db'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'

const BIOQUIMICA_STORAGE = '/Users/alexsolecarretero/Public/projects/CLASSMIND/storage/NHYD - 03 Bioquímica'
const TRANSCRIPT_DIR = path.join(BIOQUIMICA_STORAGE, 'transcripts')

// New lessons to add (audio files without PDF slides)
const NEW_LESSONS = [
  { claseNum: 7,  title: 'T7 Metabolismo de la glucosa I', audioFile: 'NHYD CLASE 7 - Metabolismo de la glucosa I AUDIO.mp3' },
  { claseNum: 8,  title: 'T8 Metabolismo de la glucosa II', audioFile: 'NHYD CLASE 8 - Metabolismo de la glucosa II AUDIO.mp3' },
  { claseNum: 10, title: 'T10 Metabolismo del glucógeno', audioFile: 'NHYD CLASE 10 - Metabolismo del glucógeno AUDIO.mp3' },
  { claseNum: 11, title: 'T11 Metabolismo lipídico I', audioFile: 'NHYD CLASE 11 - Metabolismo lipídico I AUDIO.mp3' },
  { claseNum: 12, title: 'T12 Metabolismo, glucosa y cáncer I', audioFile: 'NHYD CLASE 12 - Metabolismo, glucosa y cáncer I AUDIO.mp3' },
  { claseNum: 15, title: 'T15 Metabolismo, glucosa y cáncer II', audioFile: 'NHYD CLASE 15 - Metabolismo, glucosa y cáncer II AUDIO.mp3' },
  { claseNum: 18, title: 'T18 Metabolismo, glucosa y cáncer III', audioFile: 'NHYD CLASE 18 - Metabolismo, glucosa y cáncer III AUDIO.mp3' },
]

interface WhisperSegment {
  id: number
  text: string
  start: number
  end: number
  words?: { word: string; start: number; end: number; probability: number }[]
}

interface WhisperOutput {
  text: string
  segments: WhisperSegment[]
  language: string
}

function segmentsToChunks(segments: WhisperSegment[], chunkDurationSeconds = 30) {
  const chunks: { text: string; startTime: number; endTime: number }[] = []
  let current = { text: '', startTime: 0, endTime: 0 }

  for (const segment of segments) {
    if (current.text === '') {
      current.startTime = segment.start
    }
    current.text += (current.text ? ' ' : '') + segment.text.trim()
    current.endTime = segment.end

    if (current.endTime - current.startTime >= chunkDurationSeconds) {
      chunks.push({ ...current })
      current = { text: '', startTime: 0, endTime: 0 }
    }
  }
  if (current.text) {
    chunks.push(current)
  }
  return chunks
}

function getTranscriptPath(audioFile: string): string {
  // Whisper outputs JSON with same name as input
  const baseName = audioFile.replace('.mp3', '')
  return path.join(TRANSCRIPT_DIR, baseName + '.json')
}

async function generateCornellViaClaude(lessonTitle: string, subjectName: string, transcriptText: string): Promise<string | null> {
  const prompt = `Eres un experto en la metodología Cornell Notes. Crea un documento de estudio COMPLETO, AUTÓNOMO y MUY DETALLADO para esta lección universitaria.

LECCIÓN: ${lessonTitle}
ASIGNATURA: ${subjectName}

NOTA: Esta lección solo tiene audio (sin diapositivas). Todo el contenido viene de la transcripción del profesor.

TRANSCRIPCIÓN DEL PROFESOR:
${transcriptText.slice(0, 25000)}

---

Genera un documento de CORNELL NOTES completo siguiendo EXACTAMENTE esta estructura:

# CORNELL NOTES: ${lessonTitle}

## 📋 INFORMACIÓN DE LA LECCIÓN
- **Asignatura:** ${subjectName}
- **Tema:** ${lessonTitle}
- **Duración aproximada:** [estima basándote en el contenido]
- **Nivel de dificultad:** [Básico/Medio/Alto]

---

## 📝 COLUMNA DE PREGUNTAS CLAVE

[IMPORTANTE: Solo preguntas SIN respuestas - son para autoevaluación del estudiante]

1. ¿...?
2. ¿...?
[Incluye 12-15 preguntas clave que cubran todo el contenido]

---

## 📖 NOTAS PRINCIPALES

### 1. [Primer Tema Principal]

[Contenido detallado con:]
- **Puntos importantes en negrita**
- *Citas del profesor en cursiva: "..."*
- Listas con viñetas
- Tablas cuando sea apropiado

#### Subtema A
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
[Incluye 10-15 términos importantes]

---

## 📊 DIAGRAMAS (TEXTUALES)

\`\`\`
[Diagrama 1: Representa visualmente un proceso o concepto clave]
\`\`\`

---

## ⚡ RESUMEN

[Escribe 4-5 párrafos que sinteticen TODA la lección. Usa **negrita** para términos clave.]

---

## ✅ AUTOEVALUACIÓN

**P1:** [Pregunta]
**R:** [Respuesta detallada]

---

**P2:** [Pregunta]
**R:** [Respuesta detallada]

---

**P3:** [Pregunta]
**R:** [Respuesta detallada]

---

**P4:** [Pregunta]
**R:** [Respuesta detallada]

---

**P5:** [Pregunta]
**R:** [Respuesta detallada]

---

**P6:** [Pregunta]
**R:** [Respuesta detallada]

---

## 🔗 CONEXIONES

### Con temas anteriores:
- [Concepto previo]: Cómo se relaciona

### Con temas futuros:
- [Tema futuro]: Por qué es relevante

### Aplicaciones prácticas:
- [Aplicación]: Cómo se usa en la vida real/profesión

---

## 📚 NOTAS ADICIONALES DEL PROFESOR

> *"[Cita textual importante del profesor]"*

**Consejos de estudio mencionados:**
- [Consejo]

---

*Documento generado siguiendo la metodología Cornell Notes para estudio autónomo.*

IMPORTANTE:
- Escribe en español
- Sé MUY detallado y completo (mínimo 15000 caracteres)
- Incluye citas textuales del profesor cuando las encuentres en la transcripción
- Las PREGUNTAS CLAVE no deben tener respuestas (son para autoevaluación)
- La AUTOEVALUACIÓN sí debe tener preguntas CON respuestas
- Usa tablas, listas, negrita y formato markdown de forma abundante`

  // Write prompt to temp file to avoid shell escaping issues
  const tmpPrompt = '/tmp/classmind-cornell-prompt.txt'
  require('fs').writeFileSync(tmpPrompt, prompt)

  try {
    const result = execSync(
      `claude -p "$(cat ${tmpPrompt})" --max-turns 1 --output-format text 2>/dev/null`,
      { maxBuffer: 1024 * 1024 * 10, timeout: 300000 }
    ).toString().trim()
    return result.length > 500 ? result : null
  } catch (e) {
    console.error('Claude CLI error:', e instanceof Error ? e.message : e)
    return null
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('CLASSMIND - Process New Bioquímica Lessons')
  console.log('='.repeat(60))

  // Find subject
  const subject = await prisma.subject.findFirst({
    where: { name: { contains: 'Bioquímica' } }
  })
  if (!subject) {
    console.error('Subject Bioquímica not found!')
    return
  }
  console.log(`\nSubject: ${subject.name} (${subject.id})`)

  // Get existing lesson count for ordering
  const existingCount = await prisma.lesson.count({ where: { subjectId: subject.id } })
  console.log(`Existing lessons: ${existingCount}\n`)

  for (let i = 0; i < NEW_LESSONS.length; i++) {
    const lesson = NEW_LESSONS[i]
    const audioPath = path.join(BIOQUIMICA_STORAGE, lesson.audioFile)
    const transcriptPath = getTranscriptPath(lesson.audioFile)

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`[${i + 1}/${NEW_LESSONS.length}] ${lesson.title}`)
    console.log(`${'─'.repeat(50)}`)

    // Check audio exists
    if (!existsSync(audioPath)) {
      console.log(`  ✗ Audio not found: ${audioPath}`)
      continue
    }

    // Check transcript exists
    if (!existsSync(transcriptPath)) {
      console.log(`  ✗ Transcript not found: ${transcriptPath}`)
      console.log(`    Expected: ${transcriptPath}`)
      continue
    }

    // Check if lesson already exists
    const existing = await prisma.lesson.findFirst({
      where: { subjectId: subject.id, title: lesson.title }
    })

    let lessonId: string

    if (existing) {
      console.log(`  ⟳ Lesson already exists: ${existing.id}`)
      lessonId = existing.id
    } else {
      // Create lesson
      const newLesson = await prisma.lesson.create({
        data: {
          title: lesson.title,
          order: existingCount + i,
          status: 'READY',
          isProcessed: true,
          processedAt: new Date(),
          subjectId: subject.id,
        }
      })
      lessonId = newLesson.id
      console.log(`  ✓ Created lesson: ${lessonId}`)
    }

    // Check if audio part already exists
    const existingAudio = await prisma.audioPart.findFirst({
      where: { lessonId }
    })

    let audioPartId: string

    if (existingAudio) {
      audioPartId = existingAudio.id
      console.log(`  ⟳ Audio part exists: ${audioPartId}`)
    } else {
      // Create audio part
      const audioPart = await prisma.audioPart.create({
        data: {
          title: `Clase ${lesson.claseNum}`,
          order: 0,
          audioPath,
          lessonId,
        }
      })
      audioPartId = audioPart.id
      console.log(`  ✓ Created audio part: ${audioPartId}`)
    }

    // Check if transcript chunks already exist
    const chunkCount = await prisma.transcriptChunk.count({
      where: { audioPartId }
    })

    if (chunkCount > 0) {
      console.log(`  ⟳ Transcript already imported: ${chunkCount} chunks`)
    } else {
      // Import transcript
      const rawTranscript: WhisperOutput = JSON.parse(readFileSync(transcriptPath, 'utf-8'))
      const chunks = segmentsToChunks(rawTranscript.segments)

      // Estimate duration from last segment
      const lastSegment = rawTranscript.segments[rawTranscript.segments.length - 1]
      const duration = Math.round(lastSegment?.end || 0)

      // Update lesson duration
      await prisma.lesson.update({
        where: { id: lessonId },
        data: { totalDuration: duration }
      })

      // Update audio part duration
      await prisma.audioPart.update({
        where: { id: audioPartId },
        data: { duration }
      })

      // Create transcript chunks
      await prisma.transcriptChunk.createMany({
        data: chunks.map(c => ({
          text: c.text,
          startTime: c.startTime,
          endTime: c.endTime,
          audioPartId,
        }))
      })
      console.log(`  ✓ Imported ${chunks.length} transcript chunks (${duration}s duration)`)
    }

    // Check if Cornell notes already exist
    const existingCornell = await prisma.note.findFirst({
      where: { id: `${lessonId}-cornell-full` }
    })

    if (existingCornell && existingCornell.content.length > 10000) {
      console.log(`  ⟳ Cornell notes already exist: ${existingCornell.content.length} chars`)
      continue
    }

    // Generate Cornell notes
    console.log(`  📝 Generating Cornell notes via Claude...`)

    // Get transcript text
    const allChunks = await prisma.transcriptChunk.findMany({
      where: { audioPartId },
      orderBy: { startTime: 'asc' }
    })
    const fullTranscript = allChunks.map(c => c.text).join(' ')

    const cornellContent = await generateCornellViaClaude(
      lesson.title,
      subject.name,
      fullTranscript
    )

    if (cornellContent && cornellContent.length > 500) {
      await prisma.note.upsert({
        where: { id: `${lessonId}-cornell-full` },
        create: {
          id: `${lessonId}-cornell-full`,
          lessonId,
          content: cornellContent,
        },
        update: { content: cornellContent }
      })
      console.log(`  ✓ Cornell notes generated: ${cornellContent.length} chars`)
    } else {
      console.log(`  ✗ Cornell notes generation failed`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('DONE!')
  console.log('='.repeat(60))
}

main().catch(console.error).finally(() => prisma.$disconnect())
