'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface TranscriptChunk {
  id: string
  text: string
  startTime: number
  endTime: number
}

interface AudioPart {
  id: string
  title: string
  order: number
  audioPath: string
  duration: number | null
  transcriptChunks: TranscriptChunk[]
}

interface Slide {
  id: string
  order: number
  imagePath: string
  ocrText: string | null
}

interface Quiz {
  id: string
  title: string
  questionCount: number
}

interface Lesson {
  id: string
  title: string
  description: string | null
  subject: {
    id: string
    name: string
    color: string
    icon: string
  }
  audioParts: AudioPart[]
  slides: Slide[]
  quizzes: Quiz[]
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function LessonPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = params.lessonId as string

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentPartIndex, setCurrentPartIndex] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null)

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [showSlides, setShowSlides] = useState(true)
  const [viewMode, setViewMode] = useState<'split' | 'transcript' | 'slides'>('split')
  const [generatingQuiz, setGeneratingQuiz] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Fetch lesson data
  useEffect(() => {
    async function fetchLesson() {
      try {
        const res = await fetch(`/api/lessons/${lessonId}`)
        if (!res.ok) throw new Error('Failed to fetch lesson')
        const data = await res.json()
        setLesson(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchLesson()
  }, [lessonId])

  // Update active chunk based on current time
  useEffect(() => {
    if (!lesson || !lesson.audioParts[currentPartIndex]) return

    const chunks = lesson.audioParts[currentPartIndex].transcriptChunks
    const activeChunk = chunks.find(
      chunk => currentTime >= chunk.startTime && currentTime < chunk.endTime
    )

    if (activeChunk && activeChunk.id !== activeChunkId) {
      setActiveChunkId(activeChunk.id)

      // Scroll to active chunk
      const element = document.getElementById(`chunk-${activeChunk.id}`)
      if (element && transcriptRef.current) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentTime, lesson, currentPartIndex, activeChunkId])

  // Audio event handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)

  const seekToTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      audioRef.current.play()
    }
  }

  const switchPart = (index: number) => {
    setCurrentPartIndex(index)
    setCurrentTime(0)
    setActiveChunkId(null)
    if (audioRef.current) {
      audioRef.current.currentTime = 0
    }
  }

  const goToSlide = (index: number) => {
    if (lesson && index >= 0 && index < lesson.slides.length) {
      setCurrentSlideIndex(index)
    }
  }

  const nextSlide = () => goToSlide(currentSlideIndex + 1)
  const prevSlide = () => goToSlide(currentSlideIndex - 1)

  const generateQuiz = useCallback(async () => {
    setGeneratingQuiz(true)
    try {
      const res = await fetch(`/api/lessons/${lessonId}/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionCount: 10 })
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/quiz/${data.quizId}`)
      }
    } catch (e) {
      console.error('Error generating quiz:', e)
    } finally {
      setGeneratingQuiz(false)
    }
  }, [lessonId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Lesson not found'}</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const currentPart = lesson.audioParts[currentPartIndex]
  const currentSlide = lesson.slides[currentSlideIndex]
  const hasSlides = lesson.slides.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/subjects/${lesson.subject.id}`} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ backgroundColor: lesson.subject.color + '20', color: lesson.subject.color }}
              >
                {lesson.subject.icon}
              </div>
              <div>
                <p className="text-sm text-gray-500">{lesson.subject.name}</p>
                <h1 className="font-semibold text-gray-900">{lesson.title}</h1>
              </div>
            </div>

            {/* View Mode Switcher */}
            {hasSlides && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    viewMode === 'split' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  Split
                </button>
                <button
                  onClick={() => setViewMode('slides')}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    viewMode === 'slides' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  Slides
                </button>
                <button
                  onClick={() => setViewMode('transcript')}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    viewMode === 'transcript' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  Transcript
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Audio Player - Always visible */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Part Selector */}
            {lesson.audioParts.length > 1 && (
              <div className="flex gap-2">
                {lesson.audioParts.map((part, index) => (
                  <button
                    key={part.id}
                    onClick={() => switchPart(index)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                      currentPartIndex === index
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {part.title.replace('Parte ', 'P')}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1">
              <audio
                ref={audioRef}
                src={`/api/storage/${currentPart?.audioPath}`}
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onPause={handlePause}
                controls
                className="w-full h-10"
              />
            </div>

            <div className="text-sm text-gray-500 tabular-nums">
              {formatTime(currentTime)} / {currentPart?.duration ? formatTime(currentPart.duration) : '--:--'}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`grid gap-6 ${
          viewMode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'
        }`}>
          {/* Slides Panel */}
          {(viewMode === 'split' || viewMode === 'slides') && hasSlides && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                  Diapositiva {currentSlideIndex + 1} / {lesson.slides.length}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={prevSlide}
                    disabled={currentSlideIndex === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextSlide}
                    disabled={currentSlideIndex === lesson.slides.length - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Slide Image */}
              <div className="relative bg-gray-900 aspect-[4/3] flex items-center justify-center">
                {currentSlide && (
                  <img
                    src={`/api/storage/${currentSlide.imagePath}`}
                    alt={`Slide ${currentSlideIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>

              {/* Slide Thumbnails */}
              <div className="p-2 border-t bg-gray-50 overflow-x-auto">
                <div className="flex gap-2">
                  {lesson.slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      onClick={() => setCurrentSlideIndex(index)}
                      className={`flex-shrink-0 w-16 h-12 rounded border-2 overflow-hidden ${
                        currentSlideIndex === index
                          ? 'border-blue-600'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={`/api/storage/${slide.imagePath}`}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Transcript Panel */}
          {(viewMode === 'split' || viewMode === 'transcript') && (
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b">
                <h3 className="font-medium text-gray-900">Transcripcion</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {currentPart?.transcriptChunks.length || 0} segmentos
                </p>
              </div>
              <div
                ref={transcriptRef}
                className={`p-4 overflow-y-auto space-y-2 ${
                  viewMode === 'transcript' ? 'max-h-[600px]' : 'max-h-[450px]'
                }`}
              >
                {currentPart?.transcriptChunks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay transcripcion disponible para esta parte</p>
                  </div>
                ) : (
                  currentPart?.transcriptChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      id={`chunk-${chunk.id}`}
                      onClick={() => seekToTime(chunk.startTime)}
                      className={`p-3 rounded-lg cursor-pointer transition ${
                        activeChunkId === chunk.id
                          ? 'bg-blue-100 border-l-4 border-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs text-gray-400 font-mono mr-2">
                        {formatTime(chunk.startTime)}
                      </span>
                      <span className={activeChunkId === chunk.id ? 'text-gray-900' : 'text-gray-700'}>
                        {chunk.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-4">
          {hasSlides && (
            <Link
              href={`/lessons/${lessonId}/study`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Modo Estudio
            </Link>
          )}

          <Link
            href={`/lessons/${lessonId}/cornell`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Cornell Notes
          </Link>

          {lesson.quizzes.length > 0 ? (
            <Link
              href={`/quiz/${lesson.quizzes[0].id}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Test ({lesson.quizzes[0].questionCount} preguntas)
            </Link>
          ) : (
            <button
              onClick={generateQuiz}
              disabled={generatingQuiz}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
            >
              {generatingQuiz ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Generar Test
                </>
              )}
            </button>
          )}
        </div>

        {/* Stats Bar */}
        <div className="mt-6 bg-white rounded-lg border p-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Partes:</span>{' '}
              <span className="font-medium">{lesson.audioParts.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Duracion total:</span>{' '}
              <span className="font-medium">
                {formatTime(lesson.audioParts.reduce((sum, p) => sum + (p.duration || 0), 0))}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Segmentos:</span>{' '}
              <span className="font-medium">
                {lesson.audioParts.reduce((sum, p) => sum + p.transcriptChunks.length, 0)}
              </span>
            </div>
            {hasSlides && (
              <div>
                <span className="text-gray-500">Diapositivas:</span>{' '}
                <span className="font-medium">{lesson.slides.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
