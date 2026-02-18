import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'cpe', 'Primer-Parcial')

async function main() {
  console.log('='.repeat(60))
  console.log('CLASSMIND - Add Missing CPE Audio Parts')
  console.log('='.repeat(60))

  const subjectMap: { [key: string]: string } = {
    '03-Principios': 'principios',
    '05-Fuerza': 'fuerza',
    '06-Concurrente': 'concurrente',
    '07-Funcional': 'funcional'
  }
  let totalAdded = 0

  for (const [subjectFolder, subjectId] of Object.entries(subjectMap)) {
    const subjectPath = path.join(STORAGE_PATH, subjectFolder)

    // Get subject from DB
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId }
    })

    if (!subject) {
      console.log(`⚠️  Subject not found: ${subjectFolder}`)
      continue
    }

    console.log(`\n📚 ${subject.name}`)

    // Find all audio files
    const audioFiles = fs
      .readdirSync(subjectPath)
      .filter(f => f.endsWith('-audio.mp3'))
      .sort()

    console.log(`   Found ${audioFiles.length} audio files`)

    // Group by clase/tema
    const lessonMap = new Map<number, string[]>()
    for (const file of audioFiles) {
      const claseMatch = file.match(/Clase-(\d+)/)
      const temaMatch = file.match(/Tema-(\d+)/)
      const num = claseMatch ? parseInt(claseMatch[1]) : temaMatch ? parseInt(temaMatch[1]) : null

      if (num) {
        if (!lessonMap.has(num)) lessonMap.set(num, [])
        lessonMap.get(num)!.push(file)
      }
    }

    // Create lessons and audio parts
    for (const [lessonNum, files] of lessonMap) {
      const lessonTitle = `Clase ${lessonNum}`
      const lessonId = `cpe-${subject.id}-clase-${lessonNum}`

      // Upsert lesson
      const lesson = await prisma.lesson.upsert({
        where: { id: lessonId },
        update: { title: lessonTitle },
        create: {
          id: lessonId,
          title: lessonTitle,
          order: lessonNum,
          status: 'PENDING',
          subjectId: subject.id
        }
      })

      // Create audio parts
      for (let i = 0; i < files.length; i++) {
        const audioFile = files[i]
        const audioRelPath = path.relative(STORAGE_PATH, path.join(subjectPath, audioFile))
        const audioPartId = `cpe-${subject.id}-audio-clase${lessonNum}-parte${i + 1}`

        await prisma.audioPart.upsert({
          where: { id: audioPartId },
          update: { audioPath: audioRelPath },
          create: {
            id: audioPartId,
            lessonId: lesson.id,
            title: `Parte ${i + 1}`,
            order: i + 1,
            audioPath: audioRelPath
          }
        })

        totalAdded++
        console.log(`   ✓ Added: ${audioFile}`)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`📊 Summary: Added ${totalAdded} audio parts`)
  console.log('='.repeat(60))

  await prisma.$disconnect()
}

main().catch(console.error)
