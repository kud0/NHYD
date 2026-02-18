import { prisma } from '../lib/db'

function extractClassName(ocrText: string | null): string | null {
  if (!ocrText) return null

  // Pattern: BIENVENIDO/BIENVENIDOS A LA CLASE [NAME]
  const match = ocrText.match(/BIENVENID[OA]S? A LA CLASE\s*([A-ZÁÉÍÓÚÑ\s:,\-\(\)0-9]+?)\s*(CPE|FIT|\n|$)/i)
  if (match) {
    let name = match[1].trim()
    // Clean up whitespace
    name = name.replace(/\s+/g, ' ').trim()
    // Title case
    name = name.split(' ').map(w =>
      w.length > 3 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()
    ).join(' ')
    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1)
    return name
  }
  return null
}

async function main() {
  console.log('Updating CPE lesson titles from slide OCR...\n')

  // Get all lessons with generic "Clase X" titles that have slides
  const lessons = await prisma.lesson.findMany({
    where: {
      title: { startsWith: 'Clase ' },
      slides: { some: { order: 1 } }
    },
    include: {
      subject: true,
      slides: { where: { order: 1 }, take: 1 }
    },
    orderBy: [{ subject: { name: 'asc' } }, { order: 'asc' }]
  })

  let updated = 0

  for (const lesson of lessons) {
    // Skip if already has descriptive title (contains ":")
    if (lesson.title.includes(':')) continue

    const ocrText = lesson.slides[0]?.ocrText
    const className = extractClassName(ocrText)

    if (className && className.length > 5) {
      const newTitle = `Clase ${lesson.order}: ${className}`
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { title: newTitle }
      })
      console.log(`✓ ${lesson.subject.name}`)
      console.log(`  ${lesson.title} → ${newTitle}\n`)
      updated++
    }
  }

  console.log(`\nDone! Updated ${updated} lesson titles`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
