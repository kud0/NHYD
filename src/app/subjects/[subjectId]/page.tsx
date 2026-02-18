import Link from 'next/link'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { StudyStatusBadge, StudyProgressSummary } from '@/components/StudyStatusBadge'

type PageProps = {
  params: Promise<{ subjectId: string }>
}

async function getSubject(subjectId: string) {
  return prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          audioParts: {
            select: {
              id: true,
              title: true,
              duration: true,
              _count: {
                select: { transcriptChunks: true }
              }
            },
            orderBy: { order: 'asc' }
          },
          quizzes: {
            select: {
              id: true,
              title: true,
              questionCount: true,
            },
            take: 1,
          },
          _count: {
            select: {
              flashcards: true,
              quizzes: true,
              slides: true,
            }
          }
        }
      },
      quizzes: {
        where: { lessonId: null }, // Subject-level parcial quizzes
        select: {
          id: true,
          title: true,
          questionCount: true,
        },
        orderBy: { generatedAt: 'desc' },
      }
    }
  })
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    PROCESSING: 'bg-yellow-100 text-yellow-700',
    READY: 'bg-green-100 text-green-700',
    ERROR: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    PROCESSING: 'Procesando',
    READY: 'Listo',
    ERROR: 'Error',
  }
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.PENDING}`}>
      {labels[status] || status}
    </span>
  )
}

export default async function SubjectPage({ params }: PageProps) {
  const { subjectId } = await params
  const subject = await getSubject(subjectId)

  if (!subject) {
    notFound()
  }

  const totalDuration = subject.lessons.reduce((sum, lesson) => {
    return sum + lesson.audioParts.reduce((partSum, part) => partSum + (part.duration || 0), 0)
  }, 0)

  const totalSegments = subject.lessons.reduce((sum, lesson) => {
    return sum + lesson.audioParts.reduce((partSum, part) => partSum + part._count.transcriptChunks, 0)
  }, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: subject.color + '20', color: subject.color }}
            >
              {subject.icon || '📚'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{subject.name}</h1>
              {subject.description && (
                <p className="text-gray-500">{subject.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-2xl font-bold text-gray-900">{subject.lessons.length}</p>
            <p className="text-sm text-gray-500">Lecciones</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-2xl font-bold text-gray-900">{formatDuration(totalDuration)}</p>
            <p className="text-sm text-gray-500">Duración total</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-2xl font-bold text-gray-900">{totalSegments}</p>
            <p className="text-sm text-gray-500">Segmentos</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-2xl font-bold text-gray-900">
              {subject.lessons.reduce((sum, l) => sum + l._count.flashcards, 0)}
            </p>
            <p className="text-sm text-gray-500">Flashcards</p>
          </div>
        </div>

        {/* Study Progress */}
        <div className="bg-white rounded-lg border p-4 mb-8">
          <p className="text-sm font-medium text-gray-700 mb-2">Mi progreso</p>
          <StudyProgressSummary lessonIds={subject.lessons.map(l => l.id)} />
        </div>

        {/* Quizzes Section */}
        {(subject.quizzes.length > 0 || subject.lessons.some(l => l.quizzes.length > 0)) && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tests Disponibles</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Subject-level parcial */}
              {subject.quizzes.map(quiz => (
                <Link
                  key={quiz.id}
                  href={`/quiz/${quiz.id}`}
                  className="bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-lg p-4 hover:from-purple-700 hover:to-purple-800 transition"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold">{quiz.title}</h3>
                      <p className="text-sm text-purple-200">{quiz.questionCount} preguntas</p>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Lesson quizzes */}
              {subject.lessons.filter(l => l.quizzes.length > 0).map(lesson => (
                <Link
                  key={lesson.quizzes[0].id}
                  href={`/quiz/${lesson.quizzes[0].id}`}
                  className="bg-white border rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: subject.color + '20', color: subject.color }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{lesson.title}</h3>
                      <p className="text-sm text-gray-500">{lesson.quizzes[0].questionCount} preguntas</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Lessons List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Lecciones</h2>
            <Link
              href={`/admin/subjects/${subject.id}/lessons/new`}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Agregar lección
            </Link>
          </div>

          {subject.lessons.length === 0 ? (
            <div className="bg-white rounded-lg border-2 border-dashed p-12 text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                🎧
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">No hay lecciones</h3>
              <p className="text-sm text-gray-500 mb-4">Sube tu primera clase para empezar</p>
              <Link
                href={`/admin/subjects/${subject.id}/lessons/new`}
                className="inline-flex px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Agregar lección
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {subject.lessons.map((lesson, index) => {
                const lessonDuration = lesson.audioParts.reduce((sum, p) => sum + (p.duration || 0), 0)
                const lessonSegments = lesson.audioParts.reduce((sum, p) => sum + p._count.transcriptChunks, 0)

                return (
                  <Link
                    key={lesson.id}
                    href={`/lessons/${lesson.id}`}
                    className="block bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm"
                          style={{ backgroundColor: subject.color + '20', color: subject.color }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
                            {lesson.title}
                          </h3>
                          {lesson.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                              {lesson.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{lesson.audioParts.length} parte{lesson.audioParts.length !== 1 ? 's' : ''}</span>
                            {lessonDuration > 0 && <span>{formatDuration(lessonDuration)}</span>}
                            {lessonSegments > 0 && <span>{lessonSegments} segmentos</span>}
                            {lesson._count.flashcards > 0 && (
                              <span>{lesson._count.flashcards} flashcards</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StudyStatusBadge lessonId={lesson.id} />
                        {lesson.status !== 'READY' && getStatusBadge(lesson.status)}
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
