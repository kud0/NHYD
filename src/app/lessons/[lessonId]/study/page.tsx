'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface SlideData {
  id: string
  order: number
  imagePath: string
  note: string | null
  transcript: {
    startTime: number
    endTime: number
  }
}

interface LessonData {
  id: string
  title: string
  subject: {
    id: string
    name: string
    color: string
    icon: string
  }
  audioParts: {
    id: string
    audioPath: string
    duration: number | null
  }[]
  summary?: {
    content: string
    keyPoints: string[]
  }
}

// Parse note content into key points and one-liner
function parseNote(note: string | null): { keyPoints: string[], oneLiner: string } {
  if (!note) return { keyPoints: [], oneLiner: '' }

  const keyPoints: string[] = []
  let oneLiner = ''

  const lines = note.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
      keyPoints.push(trimmed.replace(/^[•\-]\s*/, ''))
    } else if (trimmed.startsWith('**Resumen:**')) {
      oneLiner = trimmed.replace('**Resumen:**', '').trim()
    }
  }

  return { keyPoints, oneLiner }
}

export default function StudyPage() {
  const params = useParams()
  const lessonId = params.lessonId as string

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [slides, setSlides] = useState<SlideData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [showSummary, setShowSummary] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [lessonRes, slidesRes] = await Promise.all([
          fetch(`/api/lessons/${lessonId}`),
          fetch(`/api/lessons/${lessonId}/slides`),
        ])

        if (lessonRes.ok) {
          const data = await lessonRes.json()
          setLesson(data)
        }

        if (slidesRes.ok) {
          const data = await slidesRes.json()
          setSlides(data)
        }
      } catch (e) {
        console.error('Error:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [lessonId])

  const currentSlide = slides[currentSlideIndex]
  const parsedNote = parseNote(currentSlide?.note)
  const isLastSlide = currentSlideIndex === slides.length - 1

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlideIndex(index)
      setShowSummary(false)
    }
  }

  const nextSlide = () => {
    if (isLastSlide) {
      setShowSummary(true)
    } else {
      goToSlide(currentSlideIndex + 1)
    }
  }

  const playAudio = () => {
    if (audioRef.current && currentSlide) {
      audioRef.current.currentTime = currentSlide.transcript.startTime
      audioRef.current.play()
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToSlide(currentSlideIndex - 1)
      else if (e.key === 'ArrowRight') nextSlide()
      else if (e.key === ' ') { e.preventDefault(); playAudio() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlideIndex, currentSlide, isLastSlide])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!lesson || slides.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p>No hay diapositivas</p>
      </div>
    )
  }

  // Class Summary View
  if (showSummary) {
    const lessonKeyPoints = lesson.summary?.keyPoints || []
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <button onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="text-sm text-gray-400">{lesson.subject.name}</p>
              <h1 className="font-medium">{lesson.title}</h1>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-2xl p-8 border border-blue-700/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Resumen de la Clase</h2>
                <p className="text-gray-400">{slides.length} diapositivas completadas</p>
              </div>
            </div>

            {lessonKeyPoints.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-blue-400 mb-4">PUNTOS CLAVE DE LA CLASE</h3>
                <ul className="space-y-3">
                  {lessonKeyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-gray-200">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4 mt-8">
              <Link
                href={`/lessons/${lessonId}`}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-center font-medium"
              >
                Volver a la leccion
              </Link>
              <button
                onClick={() => { setCurrentSlideIndex(0); setShowSummary(false) }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-center font-medium"
              >
                Repasar de nuevo
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Slide Study View
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/lessons/${lessonId}`} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
            <div>
              <p className="text-sm text-gray-400">{lesson.subject.name}</p>
              <h1 className="font-medium">{lesson.title}</h1>
            </div>
          </div>
          <span className="text-sm text-gray-400">
            {currentSlideIndex + 1} / {slides.length}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Slide */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4 bg-black">
            <img
              src={`/api/storage/${currentSlide?.imagePath}`}
              alt={`Slide ${currentSlideIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>

          {/* Navigation */}
          <div className="bg-gray-800 p-3 flex items-center justify-center gap-4">
            <button
              onClick={() => goToSlide(currentSlideIndex - 1)}
              disabled={currentSlideIndex === 0}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button onClick={playAudio} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Escuchar
            </button>

            <button
              onClick={nextSlide}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary Panel - Only Key Points + One Liner */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 p-6 overflow-y-auto">
          {parsedNote.keyPoints.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-blue-400 mb-4 tracking-wide">PUNTOS CLAVE</h3>
              <ul className="space-y-3 mb-6">
                {parsedNote.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-blue-400 mt-1">•</span>
                    <span className="text-gray-200 leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>

              {parsedNote.oneLiner && (
                <>
                  <h3 className="text-sm font-semibold text-purple-400 mb-3 tracking-wide">EN UNA FRASE</h3>
                  <p className="text-gray-300 leading-relaxed bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
                    {parsedNote.oneLiner}
                  </p>
                </>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Generando resumen...</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-800 h-1">
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Hidden Audio */}
      {lesson.audioParts[0] && (
        <audio ref={audioRef} src={`/api/storage/${lesson.audioParts[0].audioPath}`} className="hidden" />
      )}
    </div>
  )
}
