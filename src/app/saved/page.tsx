'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, Copy, Check, BookOpen } from 'lucide-react'
import Link from 'next/link'

interface SavedQA {
  id: string
  question: string
  answer: string
  sources: {
    title: string
    lessonId: string | null
    similarity: number
  }[]
  createdAt: string
}

export default function SavedPage() {
  const [items, setItems] = useState<SavedQA[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchSaved()
  }, [])

  const fetchSaved = async () => {
    try {
      const res = await fetch('/api/knowledge/saved')
      const data = await res.json()
      setItems(data.items || [])
    } catch (error) {
      console.error('Failed to fetch:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar esta Q&A guardada?')) return

    try {
      await fetch(`/api/knowledge/saved?id=${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/ask"
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-semibold text-zinc-900 dark:text-white">
                Q&As Guardadas
              </h1>
              <p className="text-sm text-zinc-500">
                {items.length} {items.length === 1 ? 'guardada' : 'guardadas'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12 text-zinc-500">
            Cargando...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-zinc-400" />
            </div>
            <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
              No hay Q&As guardadas
            </h2>
            <p className="text-zinc-500 mb-4">
              Cuando guardes una respuesta útil, aparecerá aquí
            </p>
            <Link
              href="/ask"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Hacer una pregunta
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
              >
                {/* Question */}
                <div className="mb-3">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">
                    Pregunta
                  </span>
                  <p className="text-zinc-900 dark:text-white font-medium mt-1">
                    {item.question}
                  </p>
                </div>

                {/* Answer */}
                <div className="mb-3">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">
                    Respuesta
                  </span>
                  <p className="text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">
                    {item.answer}
                  </p>
                </div>

                {/* Sources */}
                {item.sources && item.sources.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs text-zinc-500 uppercase tracking-wide">
                      Fuentes
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {item.sources.map((source, i) => (
                        <Link
                          key={i}
                          href={source.lessonId ? `/lessons/${source.lessonId}/cornell` : '#'}
                          className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:underline"
                        >
                          {source.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-400">
                    {formatDate(item.createdAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(item.answer, item.id)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copiar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-xs text-zinc-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
