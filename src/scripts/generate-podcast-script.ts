import { prisma } from '../lib/db'
import * as fs from 'fs'

const N8N_WEBHOOK = 'http://localhost:5678/webhook/classmind-ai'

const PODCAST_PROMPT = `Eres un creador de podcasts educativos al estilo Huberman Lab o podcasts de divulgación científica en español.

Tu tarea: Convertir estos apuntes Cornell en un GUIÓN DE PODCAST que permita aprender TODO el contenido solo escuchando.

REGLAS DEL GUIÓN:
1. **Tono conversacional** - Como si explicaras a un amigo inteligente pero que no conoce el tema
2. **Ejemplos reales** - Cada concepto importante necesita un ejemplo práctico ("Imagina que...", "Es como cuando...")
3. **Sin elementos visuales** - NO referencias a "como ves en la imagen" o "en esta tabla"
4. **Transiciones naturales** - "Ahora bien...", "Esto nos lleva a...", "¿Y por qué importa esto?"
5. **Pausas para pensar** - Incluir [PAUSA] donde el oyente debería reflexionar
6. **Duración**: 15-20 minutos de audio (aprox 3000-4000 palabras)

ESTRUCTURA:

[INTRO - 1 min]
Gancho inicial + "En este episodio vas a aprender..." + Por qué esto es útil en la vida real

[CONTEXTO - 2 min]
Situar el tema, conectar con conocimiento previo, establecer importancia

[CONTENIDO PRINCIPAL - 12-15 min]
- Explicar cada concepto con ejemplos del mundo real
- Usar analogías memorables
- Conectar ideas entre sí
- Incluir datos interesantes o curiosidades
- Aplicación práctica cuando sea posible

[CASOS PRÁCTICOS - 3 min]
"Imagina que tienes un cliente que..." o "Si alguien te pregunta..."
Escenarios reales donde aplicar lo aprendido

[CIERRE - 2 min]
Resumen de los 3-5 puntos clave
Una pregunta para reflexionar
"En el próximo episodio..."

FORMATO DEL OUTPUT:
Escribe el guión completo listo para leer. Usa:
- [PAUSA] para pausas dramáticas
- *énfasis* para palabras que necesitan énfasis al hablar
- Párrafos cortos (2-3 oraciones max)

---

APUNTES CORNELL A CONVERTIR:

`

async function generatePodcastScript(lessonId: string, cornellContent: string): Promise<string | null> {
  const prompt = PODCAST_PROMPT + cornellContent.slice(0, 25000)  // Limit to avoid timeout

  console.log(`Generating podcast script for ${lessonId}...`)
  console.log(`Prompt length: ${prompt.length} chars`)

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })

    if (!res.ok) {
      console.error(`HTTP error: ${res.status}`)
      return null
    }

    const data = await res.json()
    return data.response?.trim() || null
  } catch (error) {
    console.error('Error:', error)
    return null
  }
}

async function main() {
  const lessonIds = process.argv.slice(2)

  if (lessonIds.length === 0) {
    console.log('Usage: npx tsx scripts/generate-podcast-script.ts <lessonId1> [lessonId2] ...')
    console.log('\nExample: npx tsx scripts/generate-podcast-script.ts t3-glucidos-estructura-y-funcion')
    return
  }

  for (const lessonId of lessonIds) {
    const note = await prisma.note.findUnique({
      where: { id: `${lessonId}-cornell-full` }
    })

    if (!note) {
      console.log(`No Cornell notes found for ${lessonId}`)
      continue
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { subject: true }
    })

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Processing: ${lesson?.subject.name} - ${lesson?.title}`)
    console.log(`${'='.repeat(60)}\n`)

    const script = await generatePodcastScript(lessonId, note.content)

    if (script && script.length > 1000) {
      // Save to file
      const filename = `../storage/podcasts/${lessonId}-podcast.md`
      const dir = '../storage/podcasts'
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      fs.writeFileSync(filename, `# Podcast: ${lesson?.title}\n\n${script}`)
      console.log(`\n✓ Saved to ${filename} (${script.length} chars)`)

      // Also save to database as a note
      await prisma.note.upsert({
        where: { id: `${lessonId}-podcast` },
        create: {
          id: `${lessonId}-podcast`,
          lessonId: lessonId,
          content: script
        },
        update: { content: script }
      })
      console.log(`✓ Saved to database`)
    } else {
      console.log(`✗ Failed to generate script`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
