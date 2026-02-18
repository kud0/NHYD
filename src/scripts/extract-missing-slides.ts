import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const STORAGE_PATH = path.join(process.cwd(), 'storage', 'cpe', 'Primer-Parcial')

const SUBJECT_FOLDERS = {
  '03-Principios': 'principios',
  '05-Fuerza': 'fuerza',
  '06-Concurrente': 'concurrente',
  '07-Funcional': 'funcional'
}

async function extractSlides(pdfPath: string, outputDir: string): Promise<string[]> {
  try {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
    await execAsync(`pdftoppm -jpeg -r 150 "${pdfPath}" "${outputDir}/slide"`)
    const slides = fs
      .readdirSync(outputDir)
      .filter(f => f.startsWith('slide') && f.endsWith('.jpg'))
      .sort()
    return slides.map(s => path.join(outputDir, s))
  } catch (e) {
    console.log(`      Error extracting: ${e}`)
    return []
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('CLASSMIND - Extract Missing Slides')
  console.log('='.repeat(60))

  let totalSlides = 0

  for (const [folderName, subjectId] of Object.entries(SUBJECT_FOLDERS)) {
    const subjectPath = path.join(STORAGE_PATH, folderName)

    if (!fs.existsSync(subjectPath)) {
      console.log(`\n⚠️  Folder not found: ${folderName}`)
      continue
    }

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } })
    if (!subject) {
      console.log(`\n⚠️  Subject not found in DB: ${subjectId}`)
      continue
    }

    console.log(`\n📚 ${subject.name}`)

    // Find all PDF files
    const pdfFiles = fs
      .readdirSync(subjectPath)
      .filter(f => f.endsWith('-slides.pdf'))
      .sort()

    console.log(`   Found ${pdfFiles.length} PDF files`)

    // Get lesson patterns
    const lessons = await prisma.lesson.findMany({
      where: { subjectId: subject.id }
    })
    console.log(`   Found ${lessons.length} lessons in DB`)

    // Extract slides for each PDF
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(subjectPath, pdfFile)

      // Match to lesson
      const temaMatch = pdfFile.match(/Tema-(\d+)/)
      const claseMatch = pdfFile.match(/Clase-(\d+)/)
      const num = temaMatch ? parseInt(temaMatch[1]) : claseMatch ? parseInt(claseMatch[1]) : null

      if (!num) {
        console.log(`   ⚠️  Could not parse lesson number from: ${pdfFile}`)
        continue
      }

      const lessonId = `cpe-${subject.id}-clase-${num}`
      const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } })

      if (!lesson) {
        console.log(`   ⚠️  Lesson not found: ${lessonId}`)
        continue
      }

      // Check if lesson already has slides
      const existingSlideCount = await prisma.slide.count({
        where: { lessonId: lesson.id }
      })

      if (existingSlideCount > 0) {
        console.log(`   ✓ ${pdfFile} (${existingSlideCount} slides already extracted)`)
        totalSlides += existingSlideCount
        continue
      }

      // Extract slides
      const outputDir = path.join(STORAGE_PATH, folderName, `.slides_${num}`)
      const slidePaths = await extractSlides(pdfPath, outputDir)

      if (slidePaths.length === 0) {
        console.log(`   ✗ Failed to extract: ${pdfFile}`)
        continue
      }

      // Save to database
      for (let i = 0; i < slidePaths.length; i++) {
        const slidePath = slidePaths[i]
        const relativePath = path.relative(STORAGE_PATH, slidePath)

        await prisma.slide.create({
          data: {
            order: i + 1,
            imagePath: relativePath,
            lessonId: lesson.id
          }
        })
      }

      totalSlides += slidePaths.length
      console.log(`   ✓ ${pdfFile}: ${slidePaths.length} slides extracted`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`📊 Summary: Extracted ${totalSlides} slides`)
  console.log('='.repeat(60))

  await prisma.$disconnect()
}

main().catch(console.error)
