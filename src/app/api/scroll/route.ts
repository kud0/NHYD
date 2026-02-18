import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Sections to KEEP from Cornell notes
const KEEP_SECTIONS = [
  '## 📖 NOTAS PRINCIPALES',
  '## 🔑 CONCEPTOS Y DEFINICIONES CLAVE',
]

// Sections to REMOVE from Cornell notes
const REMOVE_SECTIONS = [
  '## 📋 INFORMACIÓN DE LA LECCIÓN',
  '## 📝 COLUMNA DE PREGUNTAS CLAVE',
  '## 📊 DIAGRAMAS',
  '## ✅ AUTOEVALUACIÓN',
  '## 🔗 CONEXIONES',
  '## 📚 NOTAS ADICIONALES DEL PROFESOR',
]

// Patterns for teacher/non-exam content
const TEACHER_PATTERNS = /\b(profes\w+|docente|instructor\w*)\b/i
const TEACHER_SUBSECTION_TITLES = /(perfil|presentaci[oó]n|biograf[ií]a|trayectoria|experiencia)\s+(del|de la)\s+(profes|docente)/i

/**
 * Strips teacher-specific and non-exam-relevant content.
 * Removes: teacher quotes, teacher profile sections, study advice,
 * and cleans inline teacher references from remaining text.
 */
function stripNonExamContent(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let skipUntilNextSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Detect subsection headers about the teacher (#### Perfil del Profesor...)
    // Skip everything until the next ### or #### header
    if (/^#{3,4}\s+/.test(trimmed) && TEACHER_SUBSECTION_TITLES.test(trimmed)) {
      skipUntilNextSection = true
      continue
    }

    // End skip when we hit the next subsection/section header
    if (skipUntilNextSection && /^#{2,4}\s+/.test(trimmed) && !TEACHER_SUBSECTION_TITLES.test(trimmed)) {
      skipUntilNextSection = false
    }

    if (skipUntilNextSection) continue

    // Remove any line that is a teacher quote (various formats)
    // > *"..."* or *"..."* - Profesor X or **"..."** patterns
    if (/^>\s*\*["«"']/.test(trimmed)) continue
    if (/^>\s*\*\*["«"']/.test(trimmed)) continue
    if (/^\*["«"'].*["»"']\*/.test(trimmed)) continue
    if (/^\*\*["«"'].*["»"']\*\*/.test(trimmed)) continue
    // Lines ending with "- Profesor/a Name" or "- destaca el profesor"
    if (/[-–—]\s*(Profes\w+|destaca|explica|señala|comenta|enfatiza)\s+(el|la)?\s*profes/i.test(trimmed)) continue
    if (/[-–—]\s*Profes\w+\s+\w+\s*\w*\s*$/i.test(trimmed)) continue
    // Lines that are "Ejemplo del profesor" or "Analogía del profesor"
    if (/^#{1,4}\s+.*\b(ejemplo|analog[ií]a|reflexi[oó]n|observaci[oó]n|anécdota)\s+(del|de la)\s+profes/i.test(trimmed)) {
      skipUntilNextSection = true
      continue
    }

    // Remove "Consejos de estudio" lines
    if (/^\*?\*?Consejos de estudio/i.test(trimmed)) continue
    // Remove "impartidos por" teacher lines
    if (/impartid[oa]s?\s+por\s+/i.test(trimmed)) continue
    // Remove **Ejemplo/Nota/Advertencia/Aclaración/Consejo/Observación/Reflexión del profesor:**
    if (/^\*\*(Ejemplo|Nota|Advertencia|Aclaraci[oó]n|Consejo|Observaci[oó]n|Reflexi[oó]n|Prueba|Argumentos?)\s+(práctico\s+)?(del|de la)\s+profes\w+/i.test(trimmed)) continue
    // Remove "Posición Crítica del Profesor" subsection headers
    if (/^#{1,4}\s+.*\b(posici[oó]n|opini[oó]n|visi[oó]n|cr[ií]tica)\s+(del|de la)\s+profes/i.test(trimmed)) {
      skipUntilNextSection = true
      continue
    }

    // Remove lines that are primarily about the teacher (not about the subject)
    if (TEACHER_PATTERNS.test(trimmed)) {
      // Skip lines where the teacher IS the subject (not teaching about something)
      const isAboutTeacher = /^(el|la)\s+(profes|docente)/i.test(trimmed) ||
        /^(como|según)\s+(menciona|dice|explica|señala|comenta|destaca|enfatiza|plantea|expone|establece|presenta|repite|insiste)\s/i.test(trimmed) ||
        /profes\w+\s+(menciona|dice|explica|señala|comenta|destaca|enfatiza|plantea|expone|establece|presenta|repite|insiste)/i.test(trimmed) ||
        /Un punto.*que\s+(el|la)\s+profes/i.test(trimmed) ||
        /experiencia\s+(profesional|práctica|clínica|laboral)\s+(del|de la)\s+profes/i.test(trimmed)
      if (isAboutTeacher) continue

      // For lines that mention teacher but also have substance, clean inline refs
      result.push(
        line
          .replace(/,?\s*(como|según)\s+(menciona|dice|explica|señala|comenta|destaca|enfatiza)\s+(el|la)\s+profes\w+\.?/gi, '.')
          .replace(/\.\s*\./g, '.')
          .replace(/(el|la)\s+profes\w+\s+(menciona|dice|explica|señala|comenta|destaca|enfatiza|plantea|expone|establece|presenta|advierte|aclara)\s*:?\s*(que\s+)?/gi, '')
          .replace(/según\s+(el|la)\s+profes\w+,?\s*/gi, '')
          .replace(/\s*[-–—]\s*(Profes\w+\s+\w+(\s+\w+)?)\s*$/gi, '')
          .replace(/descrit[oa]\s+por\s+(el|la)\s+profes\w+\s+como\s+/gi, '')
      )
      continue
    }

    result.push(line)
  }

  // Final pass cleanup on full text
  return result.join('\n')
    // Remove all italic quotes *"..."* inline (teacher speech patterns)
    .replace(/\*["«"']([^*]*?)["»"']\*/g, '')
    // Remove "- Profesor Name" attributions at end of lines
    .replace(/\s*[-–—]\s*Profes\w+\s+\w+(\s+\w+)?\s*$/gm, '')
    // Remove "| Analogía del profesor |" table columns - replace with empty
    .replace(/\|\s*(Analog[ií]a|Ejemplo|Nota|Observaci[oó]n)\s+(del|de la)\s+profes\w+\s*\|/gi, '|  |')
    // Clean "Profesor X" standalone references
    .replace(/\bProfes\w+\s+(Carlos|María|Juan|Cristóbal|Iñaki|Raúl|Daniel|Pedro|Ana|Laura|Sara)\s+\w+/gi, '')
    // Remove consecutive blank lines (max 2)
    .replace(/\n{3,}/g, '\n\n')
    // Clean up orphaned punctuation from removals
    .replace(/:\s*\.\s*$/gm, '.')
    .replace(/\.\s*\.\s*/g, '. ')
    .replace(/,\s*\./g, '.')
}

/**
 * Ultra-condenses text for scroll reading.
 * Strips filler, removes redundancy after tables, converts paragraphs to tight bullets.
 * Goal: tables + headers + only bullets with NEW information not already in tables.
 */
function condenseForScroll(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  let inPostTableZone = false // true after a table until next header

  // Collect all significant words from table cells for dedup
  const tableWords = new Set<string>()
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('|') && !t.startsWith('|--') && !t.startsWith('|-')) {
      // Extract all meaningful words from table (>3 chars)
      const cellText = t.replace(/\|/g, ' ').replace(/\*\*/g, '').replace(/\*/g, '').replace(/[,;()]/g, '')
      for (const word of cellText.split(/\s+/)) {
        const clean = word.replace(/[^a-záéíóúñü]/gi, '')
        if (clean.length > 3) tableWords.add(clean.toLowerCase())
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Track code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }
    if (inCodeBlock) { result.push(line); continue }

    // Blank lines
    if (!trimmed) {
      if (result.length > 0 && result[result.length - 1].trim() !== '') {
        result.push('')
      }
      continue
    }

    // Headers - keep and reset post-table zone
    if (/^#{1,4}\s+/.test(trimmed)) {
      inPostTableZone = false
      result.push(line)
      continue
    }

    // Table rows - keep, mark post-table zone
    if (trimmed.startsWith('|')) {
      inPostTableZone = true
      result.push(line)
      continue
    }

    // Horizontal rules
    if (/^---+$/.test(trimmed)) {
      result.push(line)
      continue
    }

    // ASCII diagrams - keep
    if (/[├└│┌┐┘┤┬┴┼║═╔╗╚╝╠╣╦╩╬‖→←↑↓]/.test(trimmed)) {
      result.push(line)
      continue
    }

    // Skip blockquotes
    if (trimmed.startsWith('>')) continue

    // Skip empty labels ("- **Something:**" with no content after colon)
    if (/^[-*]\s+\*\*[^*]+\*\*:?\s*$/.test(trimmed)) continue

    // Skip "Ejemplo aplicado/práctico" lines
    if (/Ejemplo (aplicado|práctico)/i.test(trimmed)) continue

    // Skip "Aplicaciones nutricionales/clínicas" labels
    if (/\*\*Aplicaciones (nutricional|cl[ií]nic)/i.test(trimmed)) continue

    // POST-TABLE ZONE: skip bullets that re-explain table rows
    if (inPostTableZone && /^\s*[-*]\s+/.test(line)) {
      // Skip bullets starting with bold label + colon (- **Term**: ...)
      if (/^\s*[-*]\s+\*\*[^*]+\*\*\s*:/.test(line)) {
        const labelMatch = line.match(/\*\*([^*]+)\*\*/)
        if (labelMatch) {
          const labelWords = labelMatch[1].toLowerCase().split(/\s+/).map(w => w.replace(/[^a-záéíóúñü]/gi, ''))
          const overlap = labelWords.filter(w => w.length > 3 && tableWords.has(w))
          if (overlap.length > 0) continue
        }
      }
      // Skip bullets starting with italic label + colon (- *Term*: ...)
      if (/^\s*[-*]\s+\*[^*]+\*\s*:/.test(line)) continue
      // Skip bullets starting with bold label + colon at end (- **Term:**)
      if (/^\s*[-*]\s+\*\*[^*]+:\*\*/.test(line)) continue
      // Skip plain bullets where >40% of words are already in a table
      const bulletText = line.replace(/^[\s*-]+/, '').replace(/\*\*/g, '').replace(/\*/g, '')
      const words = bulletText.split(/\s+/).map(w => w.replace(/[^a-záéíóúñü0-9%]/gi, '').toLowerCase()).filter(w => w.length > 3)
      if (words.length > 3) {
        const overlapping = words.filter(w => tableWords.has(w))
        if (overlapping.length / words.length > 0.4) continue
      }
    }

    // Skip purely transitional/connecting phrases
    if (/^[-*]?\s*(En este|A continuaci[oó]n|Es importante|Cabe |Como (hemos|se ha)|Hay que |Se puede |Por (lo tanto|consiguiente|ello)|En (resumen|conclusi[oó]n|definitiva)|Esto (significa|implica|quiere decir)|Además de|Es decir|En otras palabras|Dicho de otro modo|Vale la pena|Recordemos que|Comprender|Para (entender|comprender))/i.test(trimmed)) {
      continue
    }

    // Skip generic introductory "X is the base/foundation of Y" sentences
    if (/^[-*]?\s*(La |El |Los |Las )?\w+\s+(eucariota\s+)?(es |son |constituye |representa |funciona como )(la |el |un |una )?(unidad|base|componente|elemento|pilar|fundament)/i.test(trimmed)) {
      continue
    }

    // Existing bullet points - keep but trim verbosity
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const cleaned = line
        .replace(/\*\*Definici[oó]n\*\*:\s*/gi, '')
        .replace(/\.\s+(Esto |Es decir|Lo que |Comprender|Para entender).+$/g, '.')
      result.push(cleaned)
      continue
    }

    // Short non-tag lines
    if (trimmed.length < 20) continue

    // Remaining paragraph text → single bullet if short enough
    if (trimmed.length < 120) {
      result.push(`- ${trimmed}`)
    }
  }

  return result.join('\n')
    .replace(/^- - /gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Extracts the kept sections from a Cornell notes markdown string.
 * Splits on ## headings and keeps only the ones in KEEP_SECTIONS.
 * Also strips non-exam-relevant content (teacher quotes, advice, etc.)
 */
function extractEssentialSections(markdown: string): string {
  const lines = markdown.split('\n')
  const result: string[] = []
  let isKeptSection = false

  for (const line of lines) {
    // Skip the top-level title (# CORNELL NOTES: ...)
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      continue
    }

    // Detect section boundaries at ## level
    if (line.startsWith('## ')) {
      const sectionMatch = KEEP_SECTIONS.some(s => line.startsWith(s))
      if (sectionMatch) {
        isKeptSection = true
        result.push('')
        result.push(line)
      } else {
        isKeptSection = false
      }
      continue
    }

    if (isKeptSection) {
      result.push(line)
    }
  }

  const content = result.join('\n').trim()
  const cleaned = stripNonExamContent(content)
  return condenseForScroll(cleaned)
}

// GET /api/scroll - Returns all Cornell notes with essential sections only
export async function GET() {
  try {
    const notes = await prisma.note.findMany({
      where: {
        id: { endsWith: '-cornell-full' },
        lesson: {
          subject: {
            name: { contains: 'Bioquímica' },
          },
        },
      },
      include: {
        lesson: {
          include: {
            subject: true,
          },
        },
      },
    })

    // Sort by subject name, then lesson order
    notes.sort((a, b) => {
      const subjectCompare = (a.lesson.subject.name).localeCompare(b.lesson.subject.name)
      if (subjectCompare !== 0) return subjectCompare
      return a.lesson.order - b.lesson.order
    })

    const processed = notes.map(note => {
      // Extract the title from the first line (# CORNELL NOTES: ...)
      const firstLine = note.content.split('\n')[0] || ''
      const title = firstLine.replace(/^#\s*CORNELL NOTES:\s*/, '').trim() || note.lesson.title

      const content = extractEssentialSections(note.content)

      return {
        id: note.id,
        title,
        subjectName: note.lesson.subject.name,
        content,
      }
    })

    return NextResponse.json({ notes: processed })
  } catch (error) {
    console.error('Error fetching scroll notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scroll notes' },
      { status: 500 }
    )
  }
}
