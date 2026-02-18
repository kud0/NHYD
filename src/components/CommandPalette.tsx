'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, Loader2, FileText, BookOpen, StickyNote, ClipboardList, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface SearchResult {
  id: string
  content: string
  similarity: number
  sourceType: string
  lessonId: string | null
  subjectId: string | null
  title: string | null
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  answer: string | null
  totalResults: number
}

const sourceTypeIcons: Record<string, typeof FileText> = {
  transcript: FileText,
  slide: BookOpen,
  cornell: StickyNote,
  summary: ClipboardList,
}

const sourceTypeLabels: Record<string, string> = {
  transcript: 'Transcripción',
  slide: 'Diapositiva',
  cornell: 'Cornell Notes',
  summary: 'Resumen',
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [answer, setAnswer] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
        setResults([])
        setAnswer(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle navigation in results
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + results.length) % results.length)
      } else if (e.key === 'Enter' && results[selectedIndex]?.lessonId) {
        window.location.href = `/lessons/${results[selectedIndex].lessonId}/cornell`
      }
    }

    document.addEventListener('keydown', handleKeyNav)
    return () => document.removeEventListener('keydown', handleKeyNav)
  }, [isOpen, results, selectedIndex])

  // Debounced search
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setResults([])
      setAnswer(null)
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
          includeAnswer: true,  // This triggers AI to synthesize answer from your notes
        }),
      })

      if (res.ok) {
        const data: SearchResponse = await res.json()
        setResults(data.results)
        setAnswer(data.answer)
        setSelectedIndex(0)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounce query changes
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      search(query)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, search])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(false)
          setQuery('')
          setResults([])
          setAnswer(null)
        }}
      />

      {/* Modal */}
      <div className="relative flex min-h-full items-start justify-center pt-[15vh] px-4">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-700">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en tu base de conocimiento..."
              className="flex-1 px-4 py-4 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            ) : query ? (
              <button
                onClick={() => {
                  setQuery('')
                  setResults([])
                  setAnswer(null)
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            ) : (
              <kbd className="px-2 py-1 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 rounded">
                ESC
              </kbd>
            )}
          </div>

          {/* AI Answer */}
          {answer && (
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">
                  IA
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {answer}
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="max-h-[50vh] overflow-y-auto">
              <div className="px-3 py-2 text-xs text-slate-500 uppercase tracking-wide">
                Fuentes ({results.length})
              </div>
              {results.map((result, index) => {
                const Icon = sourceTypeIcons[result.sourceType] || FileText
                return (
                  <Link
                    key={result.id}
                    href={result.lessonId ? `/lessons/${result.lessonId}/cornell` : '#'}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      index === selectedIndex
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => {
                      setIsOpen(false)
                      setQuery('')
                      setResults([])
                      setAnswer(null)
                    }}
                  >
                    <Icon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {result.title || 'Sin título'}
                        </span>
                        <span className="px-1.5 py-0.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded">
                          {sourceTypeLabels[result.sourceType] || result.sourceType}
                        </span>
                        <span className="text-xs text-slate-400">
                          {Math.round(result.similarity * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                        {result.content}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {query.length >= 3 && !isLoading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500">
              <p>No se encontraron resultados para "{query}"</p>
              <p className="text-sm mt-1">Intenta con otras palabras clave</p>
            </div>
          )}

          {/* Initial state */}
          {!query && (
            <div className="px-4 py-6 text-center text-slate-500">
              <p className="mb-2">Busca en tus apuntes, transcripciones y resúmenes</p>
              <div className="flex justify-center gap-4 text-xs">
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                  "proteína en déficit"
                </span>
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                  "hipertrofia muscular"
                </span>
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                  "vitamina D funciones"
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↵</kbd>
                abrir
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">K</kbd>
              buscar
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
