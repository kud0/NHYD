import { prisma } from '../lib/db'

async function main() {
  const subjects = await prisma.subject.findMany({
    include: {
      lessons: {
        include: {
          slides: true,
          audioParts: { include: { transcriptChunks: true } },
          notes: true,
          quizzes: true
        }
      }
    },
    orderBy: { name: 'asc' }
  })

  console.log('='.repeat(70))
  console.log('CLASSMIND - COMPLETE STATUS REPORT')
  console.log('='.repeat(70))
  console.log()

  let totalLessons = 0
  let totalWithTranscript = 0
  let totalWithSlides = 0
  let totalWithSummaries = 0
  let totalWithCornell = 0
  let totalWithQuiz = 0
  let totalAudioHours = 0

  const missingTranscripts: string[] = []
  const missingSummaries: string[] = []
  const missingCornell: string[] = []

  for (const subject of subjects) {
    const isNHYD = ['Anatomía', 'Bioquímica', 'Bromatología', 'Nutrición', 'Antropología'].some(s => subject.name.includes(s))
    const type = isNHYD ? 'NHYD' : 'CPE'

    console.log(`\n📚 ${subject.name} [${type}]`)
    console.log('-'.repeat(60))

    let subjectAudio = 0

    for (const lesson of subject.lessons) {
      totalLessons++

      const hasTranscript = lesson.audioParts.some(ap => ap.transcriptChunks.length > 0)
      const hasSlides = lesson.slides.length > 0
      const hasSummaries = lesson.slides.some(s => s.summary && s.summary.length > 10)
      const hasCornell = lesson.notes.some(n => n.id.includes('cornell') && n.content.length > 1000)
      const hasQuiz = lesson.quizzes.length > 0

      const audioDuration = lesson.audioParts.reduce((sum, ap) => sum + (ap.duration || 0), 0)
      subjectAudio += audioDuration
      totalAudioHours += audioDuration

      if (hasTranscript) totalWithTranscript++
      if (hasSlides) totalWithSlides++
      if (hasSummaries) totalWithSummaries++
      if (hasCornell) totalWithCornell++
      if (hasQuiz) totalWithQuiz++

      if (hasSlides && !hasTranscript) missingTranscripts.push(`${subject.name} - ${lesson.title}`)
      if (hasSlides && !hasSummaries) missingSummaries.push(`${subject.name} - ${lesson.title}`)
      if (hasTranscript && !hasCornell) missingCornell.push(`${subject.name} - ${lesson.title}`)

      const status = [
        hasTranscript ? '🎙️' : '  ',
        hasSlides ? '📄' : '  ',
        hasSummaries ? '📝' : '  ',
        hasCornell ? '📒' : '  ',
        hasQuiz ? '❓' : '  '
      ].join('')

      console.log(`  ${status} ${lesson.title.slice(0, 45)}`)
    }

    const hours = Math.floor(subjectAudio / 3600)
    const mins = Math.floor((subjectAudio % 3600) / 60)
    console.log(`  📊 ${subject.lessons.length} lessons, ${hours}h ${mins}m audio`)
  }

  const hours = Math.floor(totalAudioHours / 3600)
  const mins = Math.floor((totalAudioHours % 3600) / 60)

  console.log('\n')
  console.log('='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`
Legend: 🎙️=Transcript 📄=Slides 📝=Summaries 📒=Cornell ❓=Quiz

TOTALS:
  📚 Subjects:     ${subjects.length}
  📖 Lessons:      ${totalLessons}
  🎙️ Transcripts:  ${totalWithTranscript}/${totalLessons} (${Math.round(totalWithTranscript/totalLessons*100)}%)
  📄 Slides:       ${totalWithSlides}/${totalLessons} (${Math.round(totalWithSlides/totalLessons*100)}%)
  📝 Summaries:    ${totalWithSummaries}/${totalLessons} (${Math.round(totalWithSummaries/totalLessons*100)}%)
  📒 Cornell:      ${totalWithCornell}/${totalLessons} (${Math.round(totalWithCornell/totalLessons*100)}%)
  🎧 Audio:        ${hours}h ${mins}m transcribed
`)

  if (missingTranscripts.length > 0) {
    console.log(`\n⚠️  MISSING TRANSCRIPTS (${missingTranscripts.length}):`)
    missingTranscripts.forEach(l => console.log('   - ' + l))
  }

  if (missingSummaries.length > 0) {
    console.log(`\n⚠️  MISSING SUMMARIES (${missingSummaries.length}):`)
    missingSummaries.slice(0, 15).forEach(l => console.log('   - ' + l))
    if (missingSummaries.length > 15) console.log(`   ... and ${missingSummaries.length - 15} more`)
  }

  if (missingCornell.length > 0) {
    console.log(`\n⚠️  MISSING CORNELL NOTES (${missingCornell.length}):`)
    missingCornell.slice(0, 15).forEach(l => console.log('   - ' + l))
    if (missingCornell.length > 15) console.log(`   ... and ${missingCornell.length - 15} more`)
  }

  console.log('\n' + '='.repeat(70))
}

main().finally(() => prisma.$disconnect())
