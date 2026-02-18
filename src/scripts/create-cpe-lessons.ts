import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
// Base storage path - relative paths should include cpe/Primer-Parcial/
const STORAGE_BASE = path.join(process.cwd(), '..', 'storage')
const STORAGE_PATH = path.join(STORAGE_BASE, 'cpe', 'Primer-Parcial')
const MANIFEST_PATH = '/tmp/cpe-structure-manifest.json'

interface ParsedPart {
  partNumber: number
  audioFile: string
  slidesFile: string
  title: string
}

interface ParsedLesson {
  claseNumber: number
  parts: ParsedPart[]
}

interface ParsedSubject {
  path: string
  folderName: string
  lessons: ParsedLesson[]
}

interface Manifest {
  parsedAt: string
  totalFiles: number
  subjects: ParsedSubject[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function extractSlides(pdfPath: string, outputDir: string): Promise<string[]> {
  try {
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
  const subjectFilter = process.argv
    .find(arg => arg.startsWith('--subject'))
    ?.split('=')[1]

  console.log('='.repeat(60))
  console.log('CLASSMIND - Create CPE Lessons')
  console.log('='.repeat(60))

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found. Run parse-cpe-structure.ts first.`)
    process.exit(1)
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  console.log(`\nLoaded manifest with ${manifest.subjects.length} subjects\n`)

  // Get all CPE subjects from database
  const subjects = await prisma.subject.findMany({
    where: { programId: 'cpe' }
  })
  console.log(`Found ${subjects.length} CPE subjects in database\n`)

  let totalLessonsCreated = 0
  let totalAudioPartsCreated = 0
  let totalSlidesExtracted = 0

  // Process each subject
  for (const manifestSubject of manifest.subjects) {
    // Filter by subject if specified
    if (subjectFilter && !manifestSubject.folderName.includes(subjectFilter)) continue

    // Find matching subject by name or folder (normalize accents)
    const normalizeString = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

    const normalizedFolderName = normalizeString(manifestSubject.folderName)
    const subject = subjects.find(
      s =>
        normalizedFolderName.includes(normalizeString(s.name)) ||
        normalizedFolderName.includes(s.id)
    )

    if (!subject) {
      console.warn(`⚠️  No subject found for: ${manifestSubject.folderName}`)
      continue
    }

    console.log(`📚 ${subject.name}`)

    const subjectPath = path.join(STORAGE_PATH, manifestSubject.path)

    // Process lessons
    for (const lesson of manifestSubject.lessons) {
      const lessonTitle = `Clase ${lesson.claseNumber}: ${lesson.parts[0]?.title || 'Sin título'}`
      const lessonSlug = slugify(lessonTitle)

      // Create lesson
      const createdLesson = await prisma.lesson.upsert({
        where: { id: `cpe-${subject.id}-clase-${lesson.claseNumber}` },
        update: { title: lessonTitle, order: lesson.claseNumber },
        create: {
          id: `cpe-${subject.id}-clase-${lesson.claseNumber}`,
          title: lessonTitle,
          order: lesson.claseNumber,
          status: 'PENDING',
          subjectId: subject.id
        }
      })
      totalLessonsCreated++

      // Process parts
      for (const part of lesson.parts) {
        const audioPath = path.join(subjectPath, part.audioFile)
        const pdfPath = path.join(subjectPath, part.slidesFile)

        // Create audio part
        const audioRelPath = path.relative(STORAGE_BASE, audioPath)
        const audioPartId = `cpe-${subject.id}-audio-clase${lesson.claseNumber}-parte${part.partNumber}`

        await prisma.audioPart.upsert({
          where: { id: audioPartId },
          update: { audioPath: audioRelPath },
          create: {
            id: audioPartId,
            lessonId: createdLesson.id,
            title: `Parte ${part.partNumber}`,
            order: part.partNumber,
            audioPath: audioRelPath
          }
        })
        totalAudioPartsCreated++

        // Extract and create slides
        const slidesDir = path.join(subjectPath, `clase-${lesson.claseNumber}-parte-${part.partNumber}-slides`)
        if (!fs.existsSync(slidesDir)) {
          fs.mkdirSync(slidesDir, { recursive: true })
        }

        const existingSlides = fs
          .readdirSync(slidesDir)
          .filter(f => f.endsWith('.jpg'))

        if (existingSlides.length === 0) {
          console.log(`      Extracting slides from ${part.slidesFile}...`)
          await extractSlides(pdfPath, slidesDir)
        }

        // Import slides
        const slideFiles = fs
          .readdirSync(slidesDir)
          .filter(f => f.endsWith('.jpg'))
          .sort()

        for (let i = 0; i < slideFiles.length; i++) {
          const slideFile = slideFiles[i]
          const slideRelPath = path.relative(STORAGE_BASE, path.join(slidesDir, slideFile))

          await prisma.slide.upsert({
            where: { id: `cpe-${createdLesson.id}-slide-${i}` },
            update: { imagePath: slideRelPath, order: i },
            create: {
              id: `cpe-${createdLesson.id}-slide-${i}`,
              lessonId: createdLesson.id,
              order: i,
              imagePath: slideRelPath
            }
          })
        }

        totalSlidesExtracted += slideFiles.length
      }

      console.log(
        `    ✅ Lesson ${lesson.claseNumber}: ${lesson.parts.length} parts, ${totalSlidesExtracted} slides`
      )
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   - Lessons created: ${totalLessonsCreated}`)
  console.log(`   - Audio parts created: ${totalAudioPartsCreated}`)
  console.log(`   - Slides extracted: ${totalSlidesExtracted}`)
  console.log('='.repeat(60))
  console.log('\n✨ CPE lessons creation complete!')
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
