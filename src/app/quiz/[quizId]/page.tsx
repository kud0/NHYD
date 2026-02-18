'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question {
  id: string
  question: string
  options: string[]
  order: number
}

interface QuizData {
  id: string
  title: string
  timeLimit: number
  passThreshold: number
  questionCount: number
  lesson: {
    id: string
    title: string
    subject: {
      id: string
      name: string
      color: string
    }
  } | null
  questions: Question[]
}

interface QuizResult {
  questionId: string
  question: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string | null
  options: string[]
}

interface SubmitResponse {
  attemptId: string
  score: number
  correctCount: number
  totalQuestions: number
  passed: boolean
  results: QuizResult[]
}

export default function QuizPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.quizId as string

  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<SubmitResponse | null>(null)
  const [showExplanation, setShowExplanation] = useState<string | null>(null)

  // Fetch quiz
  useEffect(() => {
    async function fetchQuiz() {
      try {
        const res = await fetch(`/api/quiz/${quizId}`)
        if (res.ok) {
          const data = await res.json()
          setQuiz(data)
          setTimeLeft(data.timeLimit * 60) // Convert to seconds
        }
      } catch (e) {
        console.error('Error:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchQuiz()
  }, [quizId])

  // Timer
  useEffect(() => {
    if (!quiz || results) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [quiz, results])

  const handleSubmit = useCallback(async () => {
    if (submitting || !quiz) return
    setSubmitting(true)

    try {
      const res = await fetch(`/api/quiz/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })

      if (res.ok) {
        const data = await res.json()
        setResults(data)
      }
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setSubmitting(false)
    }
  }, [quizId, answers, submitting, quiz])

  const selectAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p>Quiz no encontrado</p>
      </div>
    )
  }

  // Results View
  if (results) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-gray-400">{quiz.lesson?.subject.name}</p>
            <h1 className="font-medium">{quiz.title}</h1>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Score Card */}
          <div className={`rounded-2xl p-8 mb-8 ${
            results.passed
              ? 'bg-gradient-to-br from-green-900/50 to-emerald-900/50 border border-green-700/30'
              : 'bg-gradient-to-br from-red-900/50 to-orange-900/50 border border-red-700/30'
          }`}>
            <div className="text-center">
              <div className={`text-6xl font-bold mb-2 ${results.passed ? 'text-green-400' : 'text-red-400'}`}>
                {Math.round(results.score)}%
              </div>
              <p className="text-xl text-gray-300 mb-4">
                {results.correctCount} de {results.totalQuestions} correctas
              </p>
              <p className={`text-lg ${results.passed ? 'text-green-400' : 'text-red-400'}`}>
                {results.passed ? 'APROBADO' : 'NO APROBADO'}
              </p>
            </div>
          </div>

          {/* Review Questions */}
          <h2 className="text-xl font-semibold mb-4">Revisar Respuestas</h2>
          <div className="space-y-4">
            {results.results.map((r, i) => (
              <div
                key={r.questionId}
                className={`bg-gray-800 rounded-xl p-5 border ${
                  r.isCorrect ? 'border-green-700/30' : 'border-red-700/30'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    r.isCorrect ? 'bg-green-600' : 'bg-red-600'
                  }`}>
                    {i + 1}
                  </span>
                  <p className="flex-1 text-gray-200">{r.question}</p>
                </div>

                <div className="ml-11 space-y-2">
                  {r.options.map((opt, j) => {
                    const isUserAnswer = opt === r.userAnswer
                    const isCorrect = opt === r.correctAnswer
                    let optClass = 'bg-gray-700/50 text-gray-400'

                    if (isCorrect) {
                      optClass = 'bg-green-900/50 text-green-300 border border-green-600'
                    } else if (isUserAnswer && !isCorrect) {
                      optClass = 'bg-red-900/50 text-red-300 border border-red-600 line-through'
                    }

                    return (
                      <div key={j} className={`px-4 py-2 rounded-lg ${optClass}`}>
                        {opt}
                      </div>
                    )
                  })}
                </div>

                {r.explanation && (
                  <button
                    onClick={() => setShowExplanation(showExplanation === r.questionId ? null : r.questionId)}
                    className="ml-11 mt-3 text-sm text-blue-400 hover:text-blue-300"
                  >
                    {showExplanation === r.questionId ? 'Ocultar' : 'Ver'} explicacion
                  </button>
                )}

                {showExplanation === r.questionId && r.explanation && (
                  <div className="ml-11 mt-2 p-3 bg-blue-900/30 rounded-lg text-sm text-blue-200">
                    {r.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <Link
              href={`/lessons/${quiz.lesson?.id}`}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-center font-medium"
            >
              Volver a la leccion
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-center font-medium"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Quiz Taking View
  const currentQuestion = quiz.questions[currentIndex]
  const answeredCount = Object.keys(answers).length
  const isLastQuestion = currentIndex === quiz.questions.length - 1

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">{quiz.lesson?.subject.name}</p>
            <h1 className="font-medium">{quiz.title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {currentIndex + 1} / {quiz.questions.length}
            </span>
            <div className={`px-3 py-1 rounded-full font-mono text-sm ${
              timeLeft < 60 ? 'bg-red-600 animate-pulse' : 'bg-gray-700'
            }`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-gray-800 h-1">
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6">
        <div className="flex-1">
          <div className="bg-gray-800 rounded-2xl p-6 mb-6">
            <p className="text-lg leading-relaxed">{currentQuestion.question}</p>
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option, i) => {
              const isSelected = answers[currentQuestion.id] === option
              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(currentQuestion.id, option)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          <div className="flex gap-2 overflow-x-auto max-w-md">
            {quiz.questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-8 h-8 rounded-full text-sm font-medium flex-shrink-0 ${
                  i === currentIndex
                    ? 'bg-blue-600'
                    : answers[q.id]
                    ? 'bg-green-600'
                    : 'bg-gray-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Finalizar'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
