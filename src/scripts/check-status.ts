import { prisma } from '../lib/db'

async function check() {
  const subjects = await prisma.subject.findMany({
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          summary: true,
          slides: { include: { notes: true } },
          audioParts: { include: { _count: { select: { transcriptChunks: true } } } }
        }
      }
    },
    orderBy: { name: 'asc' }
  })

  console.log('='.repeat(60))
  console.log('CLASSMIND - Complete Status Check')
  console.log('='.repeat(60))

  for (const subj of subjects) {
    console.log('\n📚', subj.name)

    for (const lesson of subj.lessons) {
      const chunks = lesson.audioParts.reduce((s, a) => s + a._count.transcriptChunks, 0)
      const slidesWithNotes = lesson.slides.filter(s => s.notes.length > 0).length
      const totalSlides = lesson.slides.length
      const hasSummary = lesson.summary !== null

      const cornellNote = await prisma.note.findFirst({
        where: { id: `${lesson.id}-cornell` }
      })
      const hasCornell = cornellNote && !cornellNote.content.includes('Invalid')

      const issues: string[] = []
      if (chunks === 0) issues.push('NO TRANSCRIPT')
      if (slidesWithNotes === 0 && totalSlides > 0) issues.push('NO SLIDE NOTES')
      if (!hasSummary) issues.push('NO SUMMARY')
      if (!hasCornell) issues.push('NO CORNELL')

      const status = issues.length === 0 ? '✓' : '⚠️'
      const notesInfo = `${slidesWithNotes}/${totalSlides} slides`
      console.log(`   ${status} ${lesson.title} (${notesInfo}, ${chunks} chunks)`)
      if (issues.length > 0) console.log(`      Missing: ${issues.join(', ')}`)
    }
  }

  console.log('\n' + '='.repeat(60))
}

check().catch(console.error).finally(() => prisma.$disconnect())
