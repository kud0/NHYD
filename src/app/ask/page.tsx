'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, BookOpen, Star, Copy, Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Source {
  title: string
  lessonId: string | null
  similarity: number
  preview: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  saved?: boolean
  timestamp: Date
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('classmind-chat-history')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setMessages(parsed.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })))
      } catch (e) {
        console.error('Failed to parse chat history')
      }
    }
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('classmind-chat-history', JSON.stringify(messages))
    }
  }, [messages])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/knowledge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await res.json()

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'No pude generar una respuesta.',
        sources: data.sources,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Error al procesar tu pregunta. Intenta de nuevo.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const saveQA = async (questionMsg: Message, answerMsg: Message) => {
    try {
      await fetch('/api/knowledge/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionMsg.content,
          answer: answerMsg.content,
          sources: answerMsg.sources,
        }),
      })

      // Mark as saved in UI
      setMessages(prev => prev.map(m =>
        m.id === answerMsg.id ? { ...m, saved: true } : m
      ))
    } catch (error) {
      console.error('Failed to save Q&A:', error)
    }
  }

  const clearHistory = () => {
    if (confirm('¿Borrar todo el historial de esta sesión?')) {
      setMessages([])
      localStorage.removeItem('classmind-chat-history')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-semibold text-zinc-900 dark:text-white">
                Pregunta a tus Apuntes
              </h1>
              <p className="text-sm text-zinc-500">
                IA que responde usando tu base de conocimiento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/saved"
              className="text-sm px-3 py-1.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Guardados
            </Link>
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-sm px-3 py-1.5 text-zinc-500 hover:text-red-600"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">
                ¿Qué quieres saber?
              </h2>
              <p className="text-zinc-500 mb-6">
                Pregunta cualquier cosa sobre tus apuntes de nutrición y entrenamiento
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  '¿Qué es la hipertrofia muscular?',
                  '¿Cuánta proteína en déficit?',
                  'Explica el sistema nervioso',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, idx) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2'
                        : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-bl-md px-4 py-3'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                          📚 Fuentes:
                        </p>
                        <div className="space-y-1">
                          {msg.sources.slice(0, 3).map((source, i) => (
                            <Link
                              key={i}
                              href={source.lessonId ? `/lessons/${source.lessonId}/cornell` : '#'}
                              className="block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {source.title} ({Math.round(source.similarity * 100)}%)
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions for assistant messages */}
                    {msg.role === 'assistant' && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
                        >
                          {copiedId === msg.id ? (
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

                        {idx > 0 && messages[idx - 1]?.role === 'user' && (
                          <button
                            onClick={() => saveQA(messages[idx - 1], msg)}
                            disabled={msg.saved}
                            className={`text-xs flex items-center gap-1 ${
                              msg.saved
                                ? 'text-yellow-500'
                                : 'text-zinc-400 hover:text-yellow-500'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${msg.saved ? 'fill-current' : ''}`} />
                            {msg.saved ? 'Guardado' : 'Guardar'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              rows={1}
              className="flex-1 bg-transparent resize-none focus:outline-none text-zinc-900 dark:text-white placeholder-zinc-400 max-h-32"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-400 text-center mt-2">
            Las respuestas se basan únicamente en tus apuntes indexados
          </p>
        </div>
      </footer>
    </div>
  )
}
