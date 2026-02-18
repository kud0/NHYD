'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Extract headers from markdown for navigation
interface TocItem {
  id: string
  text: string
  level: number
}

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split('\n')
  const toc: TocItem[] = []

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].replace(/[*_`]/g, '').trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\sáéíóúñü-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 50)
      toc.push({ id, text, level })
    }
  }
  return toc
}

interface LessonInfo {
  id: string
  title: string
  subject: {
    id: string
    name: string
    color: string
    icon: string
  }
}

interface TutorQuestion {
  id: string
  selectedText: string
  question: string
  answer: string
  createdAt: string
}

interface Annotation {
  id: string
  type: 'HIGHLIGHT' | 'STICKY_NOTE'
  color: string
  selectedText?: string
  noteContent?: string
  position?: string
  createdAt: string
}

const NOTE_COLORS = {
  yellow: { bg: '#fef9c3', border: '#eab308', label: 'Nota' },
  red: { bg: '#fee2e2', border: '#ef4444', label: 'Duda' },
  green: { bg: '#dcfce7', border: '#22c55e', label: 'Entendido' }
}

export default function CornellNotesPage() {
  const params = useParams()
  const lessonId = params.lessonId as string

  const [content, setContent] = useState<string | null>(null)
  const [lesson, setLesson] = useState<LessonInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tutor state
  const [selectedText, setSelectedText] = useState('')
  const [showTutor, setShowTutor] = useState(false)
  const [tutorQuestion, setTutorQuestion] = useState('')
  const [tutorLoading, setTutorLoading] = useState(false)
  const [tutorAnswer, setTutorAnswer] = useState<string | null>(null)
  const [savedQuestions, setSavedQuestions] = useState<TutorQuestion[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteColor, setNoteColor] = useState('yellow')
  const [textForNote, setTextForNote] = useState('')
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 })
  const [showSelectionMenu, setShowSelectionMenu] = useState(false)

  // Q&A toggle state
  const [showAnswers, setShowAnswers] = useState(false)

  // Navigation sidebar state
  const [showNav, setShowNav] = useState(true)
  const [activeSection, setActiveSection] = useState<string>('')

  // Study progress state
  type StudyStatus = 'not_started' | 'studying' | 'completed' | 'review'
  const [studyStatus, setStudyStatus] = useState<StudyStatus>('not_started')
  const [quizDone, setQuizDone] = useState(false)

  // Load study progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`study-${lessonId}`)
    if (saved) {
      const data = JSON.parse(saved)
      setStudyStatus(data.status || 'not_started')
      setQuizDone(data.quizDone || false)
    }
  }, [lessonId])

  // Save study progress
  const updateStudyStatus = (status: StudyStatus) => {
    setStudyStatus(status)
    localStorage.setItem(`study-${lessonId}`, JSON.stringify({ status, quizDone }))
  }

  const toggleQuizDone = () => {
    const newVal = !quizDone
    setQuizDone(newVal)
    localStorage.setItem(`study-${lessonId}`, JSON.stringify({ status: studyStatus, quizDone: newVal }))
  }

  const studyOptions = [
    { value: 'not_started', label: 'Sin empezar', icon: '○', color: 'bg-gray-100 text-gray-600' },
    { value: 'studying', label: 'Estudiando', icon: '◐', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'completed', label: 'Completado', icon: '●', color: 'bg-green-100 text-green-700' },
    { value: 'review', label: 'Repasar', icon: '↻', color: 'bg-orange-100 text-orange-700' },
  ] as const

  const tutorRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)

  // Extract TOC from content
  const toc = useMemo(() => {
    if (!content) return []
    return extractToc(content)
  }, [content])

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const lessonRes = await fetch(`/api/lessons/${lessonId}`)
        if (lessonRes.ok) {
          const lessonData = await lessonRes.json()
          setLesson(lessonData)
        }

        const res = await fetch(`/api/lessons/${lessonId}/cornell`)
        if (!res.ok) {
          throw new Error('Cornell notes not available for this lesson')
        }
        const data = await res.json()
        setContent(data.content)

        // Fetch saved tutor questions
        const tutorRes = await fetch(`/api/lessons/${lessonId}/tutor`)
        if (tutorRes.ok) {
          const tutorData = await tutorRes.json()
          setSavedQuestions(tutorData)
        }

        // Fetch annotations
        const annotationsRes = await fetch(`/api/lessons/${lessonId}/annotations`)
        if (annotationsRes.ok) {
          const annotationsData = await annotationsRes.json()
          setAnnotations(annotationsData)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [lessonId])

  // Process answers for hide/show toggle (run after DOM updates)
  useEffect(() => {
    if (!contentRef.current || !content) return

    // Use requestAnimationFrame to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      if (!contentRef.current) return

      // Find all paragraphs that contain "R:" patterns (answers)
      const paragraphs = contentRef.current.querySelectorAll('p')

      paragraphs.forEach((p) => {
        // Skip if already processed
        if (p.querySelector('.answer-text')) return

        const html = p.innerHTML
        // Match patterns like "**R:** answer text" or "**R1:** answer text" or just "R:"
        if (html.match(/^<strong>R\d*:?<\/strong>/) || html.match(/^<strong>R:?<\/strong>/)) {
          // This is an answer paragraph - wrap content after the R: label
          const match = html.match(/^(<strong>R\d*:?<\/strong>)\s*(.*)$/s)
          if (match && match[2]) {
            p.innerHTML = `${match[1]} <span class="answer-text">${match[2]}</span><span class="answer-placeholder">[Click "Mostrar respuestas" para ver]</span>`
          }
        }
      })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [content])

  // Insert notes into the document after content loads
  useEffect(() => {
    if (!contentRef.current || annotations.length === 0 || !content) return

    // Remove existing note markers first
    const existingMarkers = contentRef.current.querySelectorAll('.note-marker')
    existingMarkers.forEach(el => el.remove())

    // For each annotation with selectedText, find and mark it
    const notesWithText = annotations.filter(a => a.selectedText && a.noteContent)

    notesWithText.forEach(annotation => {
      const searchText = annotation.selectedText!
      const color = NOTE_COLORS[annotation.color as keyof typeof NOTE_COLORS] || NOTE_COLORS.yellow

      // Walk through text nodes and find first match
      const walker = document.createTreeWalker(
        contentRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      )

      let node: Text | null
      let found = false

      while ((node = walker.nextNode() as Text | null) && !found) {
        const text = node.textContent || ''
        const index = text.indexOf(searchText.slice(0, 50)) // Match first 50 chars
        if (index !== -1) {
          found = true

          // Create the note marker element
          const marker = document.createElement('span')
          marker.className = 'note-marker'
          marker.innerHTML = `
            <span class="note-bubble" style="
              display: inline-flex;
              align-items: flex-start;
              margin-left: 8px;
              padding: 8px 12px;
              background: ${color.bg};
              border: 2px solid ${color.border};
              border-radius: 8px;
              font-size: 0.875rem;
              line-height: 1.4;
              max-width: 280px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              position: relative;
            ">
              <span style="
                position: absolute;
                left: -8px;
                top: 10px;
                width: 0;
                height: 0;
                border-top: 6px solid transparent;
                border-bottom: 6px solid transparent;
                border-right: 8px solid ${color.border};
              "></span>
              <span style="
                position: absolute;
                left: -5px;
                top: 10px;
                width: 0;
                height: 0;
                border-top: 6px solid transparent;
                border-bottom: 6px solid transparent;
                border-right: 8px solid ${color.bg};
              "></span>
              <span style="font-weight: 600; color: ${color.border}; margin-right: 6px;">📝</span>
              <span style="color: #374151;">${annotation.noteContent}</span>
            </span>
          `

          // Insert after the paragraph containing this text
          let parent = node.parentElement
          while (parent && !['P', 'LI', 'TD', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE'].includes(parent.tagName)) {
            parent = parent.parentElement
          }

          if (parent) {
            parent.insertAdjacentElement('afterend', marker)
          }
        }
      }
    })
  }, [annotations, content])

  // Scroll spy - track active section
  useEffect(() => {
    if (!contentRef.current || toc.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    )

    // Observe all headers with IDs
    const headers = contentRef.current.querySelectorAll('h1[id], h2[id], h3[id]')
    headers.forEach((header) => observer.observe(header))

    return () => observer.disconnect()
  }, [toc, content])

  // Handle text selection
  useEffect(() => {
    function handleSelection(e: MouseEvent) {
      const selection = window.getSelection()
      const text = selection?.toString().trim()

      if (text && text.length > 10) {
        const target = e.target as HTMLElement
        if (contentRef.current?.contains(target)) {
          setTextForNote(text)
          setSelectionPosition({ x: e.clientX, y: e.clientY })
          setShowSelectionMenu(true)
          setSelectedText(text) // For tutor
        }
      } else {
        // Hide menu if clicking outside
        const menu = document.getElementById('selection-menu')
        if (menu && !menu.contains(e.target as Node)) {
          setShowSelectionMenu(false)
        }
      }
    }

    document.addEventListener('mouseup', handleSelection)
    return () => document.removeEventListener('mouseup', handleSelection)
  }, [])

  // Create sticky note
  const createNote = useCallback(async () => {
    if (!noteContent.trim() || !textForNote) return

    try {
      const res = await fetch(`/api/lessons/${lessonId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'STICKY_NOTE',
          color: noteColor,
          selectedText: textForNote,
          noteContent: noteContent
        })
      })

      if (res.ok) {
        const newAnnotation = await res.json()
        setAnnotations(prev => [newAnnotation, ...prev])
        setShowNoteModal(false)
        setNoteContent('')
        setTextForNote('')
        window.getSelection()?.removeAllRanges()
      }
    } catch (e) {
      console.error('Error creating note:', e)
    }
  }, [lessonId, noteContent, noteColor, textForNote])

  // Delete annotation
  const deleteAnnotation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/lessons/${lessonId}/annotations?id=${id}`, { method: 'DELETE' })
      setAnnotations(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      console.error('Error deleting annotation:', e)
    }
  }, [lessonId])

  // Ask tutor
  async function askTutor() {
    if (!tutorQuestion.trim()) return

    setTutorLoading(true)
    setTutorAnswer(null)

    try {
      const res = await fetch(`/api/lessons/${lessonId}/tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText,
          question: tutorQuestion
        })
      })

      if (res.ok) {
        const data = await res.json()
        setTutorAnswer(data.answer)
        setSavedQuestions(prev => [data, ...prev])
        setTutorQuestion('')
      } else {
        setTutorAnswer('Error: No se pudo obtener respuesta.')
      }
    } catch (e) {
      setTutorAnswer('Error: Conexión fallida.')
    } finally {
      setTutorLoading(false)
    }
  }

  // Delete question
  async function deleteQuestion(id: string) {
    await fetch(`/api/lessons/${lessonId}/tutor?id=${id}`, { method: 'DELETE' })
    setSavedQuestions(prev => prev.filter(q => q.id !== id))
  }

  // Scroll to section
  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 100 // Account for header
      const top = element.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href={`/lessons/${lessonId}`} className="text-blue-600 hover:underline">
            Volver a la lección
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/lessons/${lessonId}`} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              {lesson && (
                <>
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
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNav(!showNav)}
                className={`p-2 rounded-lg transition-colors ${
                  showNav ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title={showNav ? 'Ocultar índice' : 'Mostrar índice'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
              <button
                onClick={() => setShowAnswers(!showAnswers)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  showAnswers ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAnswers ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"} />
                </svg>
                {showAnswers ? 'Ocultar respuestas' : 'Mostrar respuestas'}
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  showHistory ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                </svg>
                Preguntas ({savedQuestions.length})
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-gray-200" />

              {/* Study Status */}
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                {studyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateStudyStatus(opt.value as StudyStatus)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      studyStatus === opt.value
                        ? opt.color + ' shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title={opt.label}
                  >
                    {opt.icon}
                  </button>
                ))}
              </div>

              {/* Quiz Done Toggle */}
              <button
                onClick={toggleQuizDone}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  quizDone
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-400 hover:text-gray-600'
                }`}
                title={quizDone ? 'Quiz completado' : 'Marcar quiz como hecho'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Quiz
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tip Banner */}
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-200">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <span className="text-lg">💡</span>
            <strong>Tip:</strong> Selecciona texto para añadir una nota o preguntar al tutor AI. Usa el índice lateral para navegar rápidamente.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">
        {/* Navigation Sidebar */}
        {showNav && toc.length > 0 && (
          <aside className="hidden lg:block w-52 flex-shrink-0">
            <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <ul className="space-y-1 border-l border-gray-200">
                {toc.filter(item => item.level <= 2).map((item, index) => {
                  // Clean up and format display text
                  let cleanText = item.text
                    .replace(/^[📋📝❓🔑📊⚡✅🔗📚🖼️]\s*/u, '')
                    .replace(/^(COLUMNA DE |CONCEPTOS Y |DIAGRAMAS |NOTAS ADICIONALES DEL )/i, '')
                    .replace(/\(TEXTUALES\)/i, '')
                    .trim()

                  // Convert to title case for readability
                  if (cleanText === cleanText.toUpperCase()) {
                    cleanText = cleanText.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
                  }

                  const isActive = activeSection === item.id
                  const isH1 = item.level === 1

                  return (
                    <li key={index}>
                      <button
                        onClick={() => scrollToSection(item.id)}
                        className={`
                          w-full text-left text-sm py-2 pl-4 pr-2 -ml-px transition-all border-l-2
                          ${isActive
                            ? 'border-blue-500 text-blue-700 font-medium bg-blue-50/50'
                            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                          }
                          ${isH1 ? 'font-semibold text-gray-800' : ''}
                        `}
                      >
                        {cleanText}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
        {/* Stats */}
        {annotations.length > 0 && (
          <div className="mb-4 flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="text-yellow-500">📝</span>
              {annotations.length} nota{annotations.length !== 1 ? 's' : ''} en este documento
            </span>
          </div>
        )}

        {/* Main Content */}
        <main className={showHistory ? 'mr-96' : ''}>
          {/* Tutor Tip */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="font-medium text-purple-900">AI Tutor</p>
              <p className="text-sm text-purple-700">
                Selecciona cualquier texto para hacer preguntas. El tutor responderá usando SOLO el contenido de esta lección.
              </p>
            </div>
          </div>

          <article ref={contentRef} className={`cornell-notes bg-white rounded-xl border shadow-sm p-8 ${showAnswers ? 'show-answers' : 'hide-answers'}`}>
            <style jsx global>{`
              .cornell-notes h1 {
                font-size: 1.75rem;
                font-weight: 700;
                color: #1e40af;
                border-bottom: 3px solid #3b82f6;
                padding-bottom: 1rem;
                margin-bottom: 2rem;
                text-align: center;
              }

              .cornell-notes h2 {
                font-size: 1.25rem;
                font-weight: 700;
                margin-top: 2.5rem;
                margin-bottom: 1rem;
                padding: 0.75rem 1rem;
                border-radius: 0.5rem;
                background: #eff6ff;
                border-left: 4px solid #3b82f6;
                color: #1e3a8a !important;
              }

              .cornell-notes h2:first-of-type {
                background: #dbeafe;
                color: #1e3a8a !important;
                border-left: 4px solid #3b82f6;
              }

              .cornell-notes h3 {
                font-size: 1.125rem;
                font-weight: 600;
                color: #1f2937;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
                padding: 0.5rem 0.75rem;
                background: #f8fafc;
                border-radius: 0.375rem;
                border-left: 3px solid #3b82f6;
              }

              .cornell-notes h4 {
                font-size: 1rem;
                font-weight: 600;
                color: #1f2937;
                margin-top: 1rem;
                margin-bottom: 0.5rem;
                padding-left: 0.5rem;
                border-left: 2px solid #d1d5db;
              }

              .cornell-notes p {
                font-size: 1rem;
                line-height: 1.8;
                color: #1f2937;
                margin-bottom: 1rem;
              }

              .cornell-notes ul {
                margin-bottom: 1rem;
                padding-left: 1.5rem;
              }

              .cornell-notes ul li {
                font-size: 1rem;
                line-height: 1.7;
                color: #1f2937;
                margin-bottom: 0.5rem;
              }

              .cornell-notes ul li::marker {
                color: #3b82f6;
              }

              .cornell-notes ol {
                counter-reset: question;
                list-style: none;
                padding-left: 0;
                margin-bottom: 1rem;
              }

              .cornell-notes ol li {
                counter-increment: question;
                padding: 0.875rem 1rem 0.875rem 3.5rem;
                background: #fef9c3;
                border-radius: 0.5rem;
                margin-bottom: 0.5rem;
                position: relative;
                border: 1px solid #fde047;
                font-size: 1rem;
                line-height: 1.6;
                color: #000;
              }

              .cornell-notes ol li::before {
                content: counter(question);
                position: absolute;
                left: 0.875rem;
                top: 50%;
                transform: translateY(-50%);
                width: 1.75rem;
                height: 1.75rem;
                background: linear-gradient(135deg, #eab308, #ca8a04);
                color: white;
                font-weight: 700;
                font-size: 0.875rem;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.15);
              }

              .cornell-notes strong {
                color: #111827;
                font-weight: 600;
              }

              .cornell-notes em {
                color: #4b5563;
                background: #f3f4f6;
                padding: 0.125rem 0.375rem;
                border-radius: 0.25rem;
              }

              .cornell-notes table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                margin: 1.5rem 0;
                font-size: 0.95rem;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                border-radius: 0.75rem;
                overflow: hidden;
              }

              .cornell-notes th {
                background: linear-gradient(135deg, #1e40af, #3b82f6);
                color: white;
                font-weight: 600;
                padding: 0.875rem 1rem;
                text-align: left;
              }

              .cornell-notes td {
                padding: 0.75rem 1rem;
                border-bottom: 1px solid #e5e7eb;
                background: white;
                color: #1f2937;
              }

              .cornell-notes tr:last-child td {
                border-bottom: none;
              }

              .cornell-notes tr:nth-child(even) td {
                background: #f8fafc;
              }

              .cornell-notes td:first-child {
                font-weight: 600;
                color: #111827;
              }

              .cornell-notes hr {
                margin: 2.5rem 0;
                border: none;
                height: 3px;
                background: linear-gradient(90deg, transparent, #3b82f6, transparent);
              }

              .cornell-notes blockquote {
                margin: 1.5rem 0;
                padding: 1rem 1.25rem;
                background: linear-gradient(135deg, #eff6ff, #dbeafe);
                border-left: 4px solid #3b82f6;
                border-radius: 0 0.75rem 0.75rem 0;
                font-style: italic;
                color: #1e40af;
              }

              .cornell-notes blockquote p {
                margin-bottom: 0;
                color: inherit;
              }

              .cornell-notes code {
                background: #e0e7ff;
                padding: 0.125rem 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.9em;
                color: #3730a3;
                font-weight: 500;
              }

              .cornell-notes pre {
                background: linear-gradient(135deg, #1e293b, #0f172a);
                color: #e2e8f0;
                padding: 1.5rem;
                border-radius: 0.75rem;
                overflow-x: auto;
                margin: 1.5rem 0;
                font-size: 0.875rem;
                line-height: 1.7;
              }

              .cornell-notes pre code {
                background: transparent;
                padding: 0;
                color: inherit;
                font-weight: 400;
              }

              /* Note marker styles */
              .note-marker {
                display: block;
                margin: 0.5rem 0 1rem 0;
              }

              @media print {
                .cornell-notes {
                  box-shadow: none !important;
                  border: none !important;
                }
              }

              /* Answer visibility toggle */
              .cornell-notes.hide-answers .answer-text {
                display: none;
              }

              .cornell-notes.hide-answers .answer-placeholder {
                display: inline;
                color: #9ca3af;
                font-style: italic;
              }

              .cornell-notes.show-answers .answer-text {
                display: inline;
              }

              .cornell-notes.show-answers .answer-placeholder {
                display: none;
              }
            `}</style>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => {
                  const raw = String(children)
                  const clean = raw.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').replace(/[*_`]/g, '').trim()
                  const id = clean.toLowerCase().replace(/[^\w\sáéíóúñü-]/g, '').replace(/\s+/g, '-').slice(0, 50)
                  return <h1 id={id}>{clean}</h1>
                },
                h2: ({ children }) => {
                  const raw = String(children)
                  const clean = raw.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').replace(/[*_`]/g, '').trim()
                  const id = clean.toLowerCase().replace(/[^\w\sáéíóúñü-]/g, '').replace(/\s+/g, '-').slice(0, 50)
                  return <h2 id={id}>{clean}</h2>
                },
                h3: ({ children }) => {
                  const raw = String(children)
                  const clean = raw.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').replace(/[*_`]/g, '').trim()
                  const id = clean.toLowerCase().replace(/[^\w\sáéíóúñü-]/g, '').replace(/\s+/g, '-').slice(0, 50)
                  return <h3 id={id}>{clean}</h3>
                },
              }}
            >{content || ''}</ReactMarkdown>
          </article>

          {/* Print Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir / Guardar PDF
            </button>
          </div>
        </main>
        </div>

        {/* Question History Sidebar */}
        {showHistory && (
          <aside className="fixed right-0 top-16 bottom-0 w-96 bg-white border-l shadow-lg overflow-y-auto p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
              </svg>
              Historial de Preguntas
            </h3>

            {savedQuestions.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay preguntas guardadas aún.</p>
            ) : (
              <div className="space-y-4">
                {savedQuestions.map((q) => (
                  <div key={q.id} className="bg-gray-50 rounded-lg p-4 border">
                    {q.selectedText && (
                      <div className="text-xs text-gray-500 mb-2 italic border-l-2 border-gray-300 pl-2">
                        "{q.selectedText.slice(0, 100)}{q.selectedText.length > 100 ? '...' : ''}"
                      </div>
                    )}
                    <p className="font-medium text-gray-900 text-sm mb-2">
                      {q.question}
                    </p>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">
                      {q.answer}
                    </p>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs text-gray-400">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => deleteQuestion(q.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Selection Menu - appears when text is selected */}
      {showSelectionMenu && textForNote && (
        <div
          id="selection-menu"
          className="fixed z-50 bg-white rounded-xl shadow-2xl border p-2 flex gap-2"
          style={{
            left: Math.min(selectionPosition.x - 100, window.innerWidth - 220),
            top: Math.max(selectionPosition.y - 60, 60)
          }}
        >
          <button
            onClick={() => {
              setShowSelectionMenu(false)
              setShowNoteModal(true)
            }}
            className="flex items-center gap-2 px-3 py-2 bg-yellow-100 hover:bg-yellow-200 rounded-lg text-yellow-800 font-medium text-sm"
          >
            <span>📝</span>
            Añadir nota
          </button>
          <button
            onClick={() => {
              setShowSelectionMenu(false)
              setShowTutor(true)
            }}
            className="flex items-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 rounded-lg text-purple-800 font-medium text-sm"
          >
            <span>🤖</span>
            Preguntar
          </button>
          <button
            onClick={() => setShowSelectionMenu(false)}
            className="px-2 py-2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-xl">📝</span>
                Añadir nota al texto
              </h3>
              <button
                onClick={() => { setShowNoteModal(false); setNoteContent(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {/* Selected text preview */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">Texto seleccionado:</p>
                <p className="text-sm text-gray-700 italic">
                  "{textForNote.length > 200 ? textForNote.slice(0, 200) + '...' : textForNote}"
                </p>
              </div>

              {/* Color selector */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo de nota:</label>
                <div className="flex gap-2">
                  {Object.entries(NOTE_COLORS).map(([color, config]) => (
                    <button
                      key={color}
                      onClick={() => setNoteColor(color)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                        noteColor === color ? 'scale-105 shadow-md' : 'opacity-70'
                      }`}
                      style={{
                        backgroundColor: config.bg,
                        borderColor: noteColor === color ? config.border : 'transparent'
                      }}
                    >
                      <span className="text-sm font-medium">{config.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note content */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Tu nota:</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Escribe tu nota aquí... (aparecerá junto al texto seleccionado)"
                  className="w-full h-32 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                  autoFocus
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowNoteModal(false); setNoteContent(''); }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={createNote}
                  disabled={!noteContent.trim()}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Guardar nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tutor Popup */}
      {showTutor && (
        <div
          ref={tutorRef}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl border z-30"
        >
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <span className="font-medium text-gray-900">AI Tutor</span>
            </div>
            <button
              onClick={() => { setShowTutor(false); setTutorAnswer(null); setSelectedText(''); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4">
            {selectedText && (
              <div className="bg-purple-50 rounded-lg p-3 mb-4 text-sm">
                <p className="text-purple-600 font-medium text-xs mb-1">Texto seleccionado:</p>
                <p className="text-purple-900 italic">
                  "{selectedText.slice(0, 200)}{selectedText.length > 200 ? '...' : ''}"
                </p>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={tutorQuestion}
                onChange={(e) => setTutorQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askTutor()}
                placeholder="Escribe tu pregunta..."
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={tutorLoading}
              />
              <button
                onClick={askTutor}
                disabled={tutorLoading || !tutorQuestion.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {tutorLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                Preguntar
              </button>
            </div>

            {tutorAnswer && (
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <p className="text-gray-900 whitespace-pre-wrap">{tutorAnswer}</p>
              </div>
            )}

            {!tutorAnswer && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTutorQuestion('¿Puedes explicar esto con más detalle?')}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
                >
                  Explicar más
                </button>
                <button
                  onClick={() => setTutorQuestion('¿Puedes darme un ejemplo?')}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
                >
                  Dame un ejemplo
                </button>
                <button
                  onClick={() => setTutorQuestion('¿Por qué es importante esto?')}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
                >
                  ¿Por qué es importante?
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
