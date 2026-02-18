'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Subject {
  id: string
  name: string
  description: string | null
  semester: number
  color: string
  icon: string | null
  order: number
  lessonCount: number
  readyLessons: number
  totalDuration: number
  _count: {
    lessons: number
  }
  lessons: {
    id: string
    status: string
    totalDuration: number | null
    _count?: {
      flashcards: number
    }
  }[]
}

interface Program {
  id: string
  name: string
  fullName: string
  description: string | null
  color: string
  icon: string | null
  subjects: Subject[]
  subjectsBySemester: Record<number, Subject[]>
}

export default function ProgramPage() {
  const params = useParams()
  const programId = params.programId as string
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overallProgress, setOverallProgress] = useState({ completed: 0, studying: 0, review: 0, total: 0 })

  useEffect(() => {
    async function fetchProgram() {
      try {
        const res = await fetch(`/api/programs/${programId}`)
        if (!res.ok) {
          throw new Error('Program not found')
        }
        const data = await res.json()
        setProgram(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load program')
      } finally {
        setLoading(false)
      }
    }
    fetchProgram()
  }, [programId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !program) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Error
          </h1>
          <p className="text-zinc-500">{error || 'Program not found'}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  // Group subjects by semester
  const semesters = [...new Set(program.subjects.map(s => s.semester))].sort((a, b) => a - b)

  // Calculate totals
  const totalSubjects = program.subjects.length
  const totalLessons = program.subjects.reduce((sum, s) => sum + s.lessonCount, 0)
  const readyLessons = program.subjects.reduce((sum, s) => sum + s.readyLessons, 0)
  const totalDuration = program.subjects.reduce((sum, s) => sum + s.totalDuration, 0)

  // Determine semester label based on program
  const semesterLabel = program.name === 'CPE' ? 'Parcial' : 'Semestre'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: program.color + '20', color: program.color }}
            >
              {program.icon || '📚'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {program.name}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {program.fullName}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalSubjects}</p>
            <p className="text-sm text-blue-600/80 dark:text-blue-400/80">Asignaturas</p>
          </div>
          <div className="rounded-xl bg-green-50 p-4 dark:bg-green-900/20">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{readyLessons}/{totalLessons}</p>
            <p className="text-sm text-green-600/80 dark:text-green-400/80">Lecciones listas</p>
          </div>
          <div className="rounded-xl bg-purple-50 p-4 dark:bg-purple-900/20">
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{semesters.length}</p>
            <p className="text-sm text-purple-600/80 dark:text-purple-400/80">{semesterLabel}es</p>
          </div>
          <div className="rounded-xl bg-orange-50 p-4 dark:bg-orange-900/20">
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {Math.round(totalDuration / 3600)}h
            </p>
            <p className="text-sm text-orange-600/80 dark:text-orange-400/80">Contenido</p>
          </div>
        </div>

        {/* Subjects by Semester */}
        {semesters.map(semester => {
          const semesterSubjects = program.subjects.filter(s => s.semester === semester)

          return (
            <section key={semester} className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                {semesterLabel} {semester}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {semesterSubjects.map(subject => (
                  <SubjectCard key={subject.id} subject={subject} />
                ))}
              </div>
            </section>
          )
        })}

        {program.subjects.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-2xl dark:bg-zinc-800">
              📚
            </div>
            <h3 className="mb-2 font-semibold text-zinc-900 dark:text-white">
              No hay asignaturas
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Este programa aún no tiene asignaturas
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

function SubjectCard({ subject }: { subject: Subject }) {
  const totalFlashcards = subject.lessons?.reduce(
    (sum, l) => sum + (l._count?.flashcards || 0),
    0
  ) || 0

  // Study progress from localStorage
  const [studyStats, setStudyStats] = useState({ completed: 0, studying: 0, review: 0 })

  useEffect(() => {
    if (!subject.lessons?.length) return
    let completed = 0, studying = 0, review = 0
    subject.lessons.forEach(lesson => {
      const saved = localStorage.getItem(`study-${lesson.id}`)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.status === 'completed') completed++
        else if (data.status === 'studying') studying++
        else if (data.status === 'review') review++
      }
    })
    setStudyStats({ completed, studying, review })
  }, [subject.lessons])

  const progress = subject.lessonCount > 0
    ? Math.round((studyStats.completed / subject.lessonCount) * 100)
    : 0

  return (
    <Link
      href={`/subjects/${subject.id}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: subject.color + '20', color: subject.color }}
        >
          {subject.icon || '📚'}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-white">
            {subject.name}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {subject.readyLessons}/{subject.lessonCount} lecciones listas
          </p>
        </div>
        {/* Study progress indicator */}
        {subject.lessonCount > 0 && (
          <div className="text-right">
            <span className="text-sm font-medium text-zinc-600">{progress}%</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {subject.lessonCount > 0 && (
        <div className="mb-4 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Mi Progreso</span>
            <span className="text-lg font-bold text-zinc-800">{progress}%</span>
          </div>
          <div className="h-3 bg-zinc-200 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {studyStats.completed} completadas
            </span>
            <span className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              {studyStats.studying} estudiando
            </span>
            <span className="flex items-center gap-1.5 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              {studyStats.review} repasar
            </span>
          </div>
        </div>
      )}

      {subject.description && (
        <p className="mb-3 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
          {subject.description}
        </p>
      )}

      <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{subject.lessonCount} lecciones</span>
        {totalFlashcards > 0 && <span>{totalFlashcards} flashcards</span>}
        {subject.totalDuration > 0 && (
          <span>{Math.round(subject.totalDuration / 60)} min</span>
        )}
      </div>
    </Link>
  )
}
