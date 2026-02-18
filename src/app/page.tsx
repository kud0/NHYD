import Link from 'next/link'
import { prisma } from '@/lib/db'

async function getStats() {
  const [programCount, subjectCount, lessonCount, flashcardsDue, totalFlashcards] = await Promise.all([
    prisma.program.count(),
    prisma.subject.count(),
    prisma.lesson.count(),
    prisma.flashcard.count({
      where: {
        nextReview: { lte: new Date() }
      }
    }),
    prisma.flashcard.count()
  ])

  return { programCount, subjectCount, lessonCount, flashcardsDue, totalFlashcards }
}

async function getPrograms() {
  return prisma.program.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: {
        select: { subjects: true }
      },
      subjects: {
        select: {
          id: true,
          _count: {
            select: { lessons: true }
          },
          lessons: {
            select: {
              status: true,
              _count: {
                select: { flashcards: true }
              }
            }
          }
        }
      }
    }
  })
}

export default async function HomePage() {
  const stats = await getStats()
  const programs = await getPrograms()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                ClassMind
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Tu plataforma de estudio inteligente
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/flashcards"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Repasar ({stats.flashcardsDue})
              </Link>
              <Link
                href="/admin"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard
            label="Programas"
            value={stats.programCount}
            color="indigo"
          />
          <StatCard
            label="Asignaturas"
            value={stats.subjectCount}
            color="blue"
          />
          <StatCard
            label="Lecciones"
            value={stats.lessonCount}
            color="green"
          />
          <StatCard
            label="Flashcards"
            value={stats.totalFlashcards}
            color="purple"
          />
          <StatCard
            label="Para repasar"
            value={stats.flashcardsDue}
            color="orange"
          />
        </div>

        {/* Programs Grid */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Mis Programas
            </h2>
          </div>

          {programs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {programs.map(program => (
                <ProgramCard key={program.id} program={program} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'blue' | 'green' | 'purple' | 'orange' | 'indigo'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
  }

  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  )
}

function ProgramCard({
  program,
}: {
  program: Awaited<ReturnType<typeof getPrograms>>[0]
}) {
  const totalLessons = program.subjects.reduce(
    (sum, s) => sum + s._count.lessons,
    0
  )
  const readyLessons = program.subjects.reduce(
    (sum, s) => sum + s.lessons.filter(l => l.status === 'READY').length,
    0
  )
  const totalFlashcards = program.subjects.reduce(
    (sum, s) => sum + s.lessons.reduce((lSum, l) => lSum + l._count.flashcards, 0),
    0
  )

  return (
    <Link
      href={`/programs/${program.id}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-lg hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="mb-4 flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundColor: program.color + '20', color: program.color }}
        >
          {program.icon || '📚'}
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900 group-hover:text-blue-600 dark:text-white">
            {program.name}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {program.fullName}
          </p>
        </div>
      </div>

      {program.description && (
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {program.description}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
          <p className="text-lg font-semibold text-zinc-900 dark:text-white">
            {program._count.subjects}
          </p>
          <p className="text-xs text-zinc-500">Asignaturas</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
          <p className="text-lg font-semibold text-zinc-900 dark:text-white">
            {readyLessons}/{totalLessons}
          </p>
          <p className="text-xs text-zinc-500">Lecciones</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
          <p className="text-lg font-semibold text-zinc-900 dark:text-white">
            {totalFlashcards}
          </p>
          <p className="text-xs text-zinc-500">Flashcards</p>
        </div>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-2xl dark:bg-zinc-800">
        📚
      </div>
      <h3 className="mb-2 font-semibold text-zinc-900 dark:text-white">
        No hay programas
      </h3>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Ejecuta el seed para crear los programas iniciales
      </p>
      <code className="rounded bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
        npx ts-node src/scripts/seed-programs.ts
      </code>
    </div>
  )
}
