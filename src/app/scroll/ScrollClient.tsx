'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface ScrollNote {
  id: string
  title: string
  subjectName: string
  content: string
}

// ------------------------------------------------------------------
// Lightweight markdown-to-HTML converter
// ------------------------------------------------------------------

function mdToHtml(md: string): string {
  let html = md

  // Escape HTML entities first (but preserve our own tags later)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Tables: detect lines with | and convert
  html = html.replace(
    /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_match, headerRow: string, _separator: string, bodyRows: string) => {
      const headers = headerRow
        .split('|')
        .filter((c: string) => c.trim())
        .map((c: string) => `<th class="border border-zinc-700 px-2 py-1 text-left text-sm text-zinc-100 font-semibold">${c.trim()}</th>`)
        .join('')
      const rows = bodyRows
        .trim()
        .split('\n')
        .map((row: string) => {
          const cells = row
            .split('|')
            .filter((c: string) => c.trim())
            .map((c: string) => `<td class="border border-zinc-700 px-2 py-1 text-sm text-zinc-200">${c.trim()}</td>`)
            .join('')
          return `<tr>${cells}</tr>`
        })
        .join('')
      return `<table class="w-full border-collapse my-3"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
    }
  )

  // Code blocks (```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-zinc-900 border border-zinc-800 rounded p-3 my-3 overflow-x-auto text-sm text-zinc-200"><code>$2</code></pre>'
  )

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1 rounded text-sm text-zinc-100">$1</code>')

  // Headers (#### before ### before ##)
  html = html.replace(
    /^#### (.+)$/gm,
    '<h4 class="text-base font-semibold text-zinc-100 mt-4 mb-1">$1</h4>'
  )
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="text-lg font-semibold text-white mt-5 mb-2">$1</h3>'
  )
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>'
  )

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em class="text-white">$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em class="text-zinc-200 italic">$1</em>')

  // Unordered lists (lines starting with - or *)
  html = html.replace(/^(\s*)[-*] (.+)$/gm, (_match, indent: string, text: string) => {
    const level = Math.floor(indent.length / 2)
    const ml = level > 0 ? ` ml-${level * 4}` : ''
    return `<li class="text-zinc-200 ml-4${ml} list-disc">${text}</li>`
  })
  // Wrap consecutive <li> into <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-2 space-y-1">$1</ul>')

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="text-zinc-200 ml-4 list-decimal">$1</li>')
  html = html.replace(
    /((?:<li class="text-zinc-300 ml-4 list-decimal">.*<\/li>\n?)+)/g,
    '<ol class="my-2 space-y-1">$1</ol>'
  )

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="border-zinc-800 my-4" />')

  // Paragraphs: wrap remaining non-empty lines that aren't tags
  html = html
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<')) return line
      return `<p class="text-zinc-200 leading-relaxed mb-2">${trimmed}</p>`
    })
    .join('\n')

  return html
}

// ------------------------------------------------------------------
// Subject color palette
// ------------------------------------------------------------------

const SUBJECT_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#EF4444', // red
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
]

function getSubjectColor(subjectName: string, subjectMap: Map<string, number>): string {
  if (!subjectMap.has(subjectName)) {
    subjectMap.set(subjectName, subjectMap.size)
  }
  return SUBJECT_COLORS[subjectMap.get(subjectName)! % SUBJECT_COLORS.length]
}

// ------------------------------------------------------------------
// ScrollClient Component
// ------------------------------------------------------------------

export default function ScrollClient() {
  const [notes, setNotes] = useState<ScrollNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [currentSubject, setCurrentSubject] = useState('')
  const [showControls, setShowControls] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollPosRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const subjectMapRef = useRef(new Map<string, number>())
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)

  // Keep refs in sync with state
  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  // ------------------------------------------------------------------
  // Fetch notes
  // ------------------------------------------------------------------

  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch('/scroll-data.json')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setNotes(data.notes || [])
      } catch (err) {
        setError('Error al cargar las notas')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotes()
  }, [])

  // ------------------------------------------------------------------
  // Wake Lock
  // ------------------------------------------------------------------

  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch (err) {
        console.warn('Wake Lock not supported or denied:', err)
      }
    }

    requestWakeLock()

    // Re-acquire on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      wakeLockRef.current?.release().catch(() => {})
    }
  }, [])

  // ------------------------------------------------------------------
  // Track current subject based on scroll position
  // ------------------------------------------------------------------

  const updateCurrentSubject = useCallback(() => {
    if (!containerRef.current) return

    const dividers = containerRef.current.querySelectorAll<HTMLElement>('[data-subject]')
    const scrollTop = containerRef.current.scrollTop
    const viewportMid = scrollTop + window.innerHeight / 3

    let closest = ''
    for (const div of dividers) {
      if (div.offsetTop <= viewportMid) {
        closest = div.dataset.subject || ''
      }
    }
    if (closest && closest !== currentSubject) {
      setCurrentSubject(closest)
    }
  }, [currentSubject])

  // ------------------------------------------------------------------
  // Auto-scroll with requestAnimationFrame
  // ------------------------------------------------------------------

  useEffect(() => {
    if (notes.length === 0) return

    const container = containerRef.current
    if (!container) return

    let lastTime = 0

    function tick(timestamp: number) {
      if (!lastTime) lastTime = timestamp
      const delta = timestamp - lastTime
      lastTime = timestamp

      if (playingRef.current && container) {
        // Base speed: ~30px per second at 1x
        const pixelsPerMs = (30 * speedRef.current) / 1000
        scrollPosRef.current += pixelsPerMs * delta

        const scrollHeight = container.scrollHeight
        const clientHeight = container.clientHeight
        const halfPoint = (scrollHeight - clientHeight) / 2

        // When we pass the halfway point (second copy), reset to start
        if (halfPoint > 0 && scrollPosRef.current >= halfPoint) {
          scrollPosRef.current -= halfPoint
        }

        container.scrollTop = scrollPosRef.current
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [notes])

  // ------------------------------------------------------------------
  // Subject tracking on scroll
  // ------------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let throttle: ReturnType<typeof setTimeout> | null = null
    const handleScroll = () => {
      if (throttle) return
      throttle = setTimeout(() => {
        updateCurrentSubject()
        throttle = null
      }, 200)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [updateCurrentSubject])

  // ------------------------------------------------------------------
  // Handle manual scroll: pause auto-scroll, sync position
  // ------------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let touchActive = false

    const onTouchStart = () => {
      touchActive = true
    }

    const onTouchEnd = () => {
      touchActive = false
      // Sync scroll position so auto-scroll continues from here
      scrollPosRef.current = container.scrollTop
    }

    const onWheel = () => {
      scrollPosRef.current = container.scrollTop
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
    container.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('wheel', onWheel)
    }
  }, [])

  // ------------------------------------------------------------------
  // Render notes as HTML (builds both copies for seamless loop)
  // ------------------------------------------------------------------

  function renderNotes(notesList: ScrollNote[]): string {
    const subjectMap = subjectMapRef.current
    let html = ''
    let lastSubject = ''

    for (const note of notesList) {
      // Subject divider
      if (note.subjectName !== lastSubject) {
        const color = getSubjectColor(note.subjectName, subjectMap)
        html += `
          <div data-subject="${note.subjectName}" class="flex items-center gap-3 py-6 px-4">
            <div class="h-px flex-1" style="background: ${color}"></div>
            <span class="text-sm font-semibold uppercase tracking-wider whitespace-nowrap" style="color: ${color}">${note.subjectName}</span>
            <div class="h-px flex-1" style="background: ${color}"></div>
          </div>
        `
        lastSubject = note.subjectName
      }

      // Note title
      html += `
        <div class="px-4 mb-4">
          <h2 class="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2 mb-3">${note.title}</h2>
          <div class="note-content">
            ${mdToHtml(note.content)}
          </div>
          <div class="h-px bg-zinc-900 my-6"></div>
        </div>
      `
    }

    return html
  }

  // ------------------------------------------------------------------
  // Loading / Error states
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-zinc-400 text-lg animate-pulse">Cargando notas...</div>
      </div>
    )
  }

  if (error || notes.length === 0) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-zinc-500 text-lg">{error || 'No hay notas disponibles'}</div>
      </div>
    )
  }

  // Build the doubled content for seamless infinite scroll
  const singlePass = renderNotes(notes)
  const doubledContent = singlePass + singlePass

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div
          ref={contentRef}
          className="max-w-[375px] mx-auto py-8 text-base"
          dangerouslySetInnerHTML={{ __html: doubledContent }}
        />
      </div>

      {/* Tap zone to toggle controls */}
      <div
        className="fixed bottom-0 left-0 right-0 h-16 z-10"
        onClick={() => {
          setShowControls(v => !v)
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
          hideTimerRef.current = setTimeout(() => setShowControls(false), 5000)
        }}
      />

      {/* Floating control bar - hidden by default, tap bottom to show */}
      <div
        className="fixed bottom-0 left-0 right-0 safe-area-bottom z-20 transition-all duration-300"
        style={{
          transform: showControls ? 'translateY(0)' : 'translateY(100%)',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
        }}
      >
        <div className="mx-auto max-w-[375px] px-3 pb-3">
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl"
            style={{
              background: 'rgba(24, 24, 27, 0.85)',
              borderTop: '1px solid rgba(63, 63, 70, 0.5)',
            }}
          >
            {/* Play/Pause */}
            <button
              onClick={(e) => { e.stopPropagation(); setPlaying(p => !p) }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 transition hover:bg-zinc-700 active:scale-95"
              aria-label={playing ? 'Pausar' : 'Reproducir'}
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="2" width="4" height="12" rx="1" />
                  <rect x="9" y="2" width="4" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2.5v11l9-5.5L4 2.5z" />
                </svg>
              )}
            </button>

            {/* Speed slider */}
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>{currentSubject || '\u00A0'}</span>
                <span>{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={speed}
                onClick={(e) => e.stopPropagation()}
                onChange={e => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1 appearance-none bg-zinc-700 rounded-full outline-none accent-zinc-400"
                style={{ accentColor: '#a1a1aa' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Global styles for scrollbar hiding and safe area */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        /* Smooth range input on iOS */
        input[type="range"] {
          -webkit-appearance: none;
          height: 4px;
          border-radius: 2px;
          background: #3f3f46;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #a1a1aa;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
