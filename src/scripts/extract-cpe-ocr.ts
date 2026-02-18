import { prisma } from '../lib/db'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'

const execAsync = promisify(exec)
const STORAGE_PATH = path.join(process.cwd(), 'storage', 'cpe', 'Primer-Parcial')

async function extractOCRWithTesseract(imagePath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`tesseract "${imagePath}" stdout -l spa`)
    return stdout.trim()
  } catch (e) {
    console.log(`        OCR error: ${e}`)
    return null
  }
}

async function main() {
  const subjectFilter = process.argv
    .find(arg => arg.startsWith('--subject'))
    ?.split('=')[1]

  console.log('='.repeat(60))
  console.log('CLASSMIND - Extract CPE OCR')
  console.log('='.repeat(60))

  // Find all CPE slides without OCR
  const slides = await prisma.slide.findMany({
    where: {
      lesson: {
        subject: {
          programId: 'cpe'
        }
      },
      OR: [{ ocrText: null }, { ocrText: '' }]
    },
    include: {
      lesson: {
        include: { subject: true }
      }
    }
  })

  console.log(`\n📄 Found ${slides.length} slides to OCR\n`)

  if (slides.length === 0) {
    console.log('All slides already OCR\'d!')
    return
  }

  let processed = 0
  let successful = 0
  let failed = 0

  for (const slide of slides) {
    // Filter by subject if specified
    if (subjectFilter && !slide.lesson.subject.id.includes(subjectFilter)) continue

    processed++
    const imagePath = path.join(STORAGE_PATH, slide.imagePath)

    process.stdout.write(
      `[${processed}/${slides.length}] ${slide.lesson.subject.name} - Slide ${slide.order}... `
    )

    try {
      const ocrText = await extractOCRWithTesseract(imagePath)

      if (ocrText) {
        await prisma.slide.update({
          where: { id: slide.id },
          data: { ocrText }
        })
        console.log(`✓ (${ocrText.length} chars)`)
        successful++
      } else {
        console.log('✗ (no text)')
        failed++
      }
    } catch (e) {
      console.log(`✗ (error)`)
      failed++
    }

    // Throttle
    await new Promise(r => setTimeout(r, 100))
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   - Processed: ${processed}`)
  console.log(`   - Successful: ${successful}`)
  console.log(`   - Failed: ${failed}`)
  console.log('='.repeat(60))
  console.log('\n✨ CPE OCR extraction complete!')
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
