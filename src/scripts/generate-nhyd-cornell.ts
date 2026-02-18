import { prisma } from '../lib/db'
import { execSync } from 'child_process'

async function main() {
  const subjects = await prisma.subject.findMany({
    where: { programId: 'nhyd' },
    orderBy: { name: 'asc' }
  })

  console.log('='.repeat(60))
  console.log('GENERATING CORNELL NOTES FOR ALL NHYD SUBJECTS')
  console.log('='.repeat(60))
  console.log(`\nSubjects: ${subjects.length}\n`)

  for (const subject of subjects) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Starting: ${subject.name}`)
    console.log('='.repeat(60))

    try {
      execSync(`npx tsx scripts/generate-cornell-notes.ts ${subject.id}`, {
        cwd: '/Users/alexsolecarretero/Public/projects/CLASSMIND/src',
        stdio: 'inherit'
      })
    } catch (e) {
      console.log(`Error with ${subject.id}:`, e)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('ALL NHYD CORNELL NOTES COMPLETE!')
  console.log('='.repeat(60))

  await prisma.$disconnect()
}

main().catch(console.error)
