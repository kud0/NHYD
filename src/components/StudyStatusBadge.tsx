'use client'

import { useState, useEffect } from 'react'

type StudyStatus = 'not_started' | 'studying' | 'completed' | 'review'

interface StudyData {
  status: StudyStatus
  quizDone: boolean
}

const statusConfig = {
  not_started: { icon: '○', label: 'Sin empezar', color: 'text-gray-400', bg: 'bg-gray-100' },
  studying: { icon: '◐', label: 'Estudiando', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  completed: { icon: '●', label: 'Completado', color: 'text-green-600', bg: 'bg-green-100' },
  review: { icon: '↻', label: 'Repasar', color: 'text-orange-600', bg: 'bg-orange-100' },
}

interface Props {
  lessonId: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function StudyStatusBadge({ lessonId, showLabel = true, size = 'sm' }: Props) {
  const [data, setData] = useState<StudyData>({ status: 'not_started', quizDone: false })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(`study-${lessonId}`)
    if (saved) {
      setData(JSON.parse(saved))
    }
  }, [lessonId])

  if (!mounted) {
    return <span className="w-20 h-5" /> // Placeholder to prevent layout shift
  }

  // Don't show anything for not_started
  if (data.status === 'not_started' && !data.quizDone) {
    return null
  }

  const config = statusConfig[data.status]
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'

  return (
    <div className="flex items-center gap-2">
      {data.status !== 'not_started' && (
        <span className={`${config.bg} ${config.color} ${sizeClasses} rounded-full font-medium flex items-center gap-1`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.color.replace('text-', 'bg-')}`}></span>
          {config.label}
        </span>
      )}
      {data.quizDone && (
        <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full font-medium">
          Quiz ✓
        </span>
      )}
    </div>
  )
}

// Summary component for stats
interface SummaryProps {
  lessonIds: string[]
}

export function StudyProgressSummary({ lessonIds }: SummaryProps) {
  const [stats, setStats] = useState({ completed: 0, studying: 0, review: 0, total: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    let completed = 0, studying = 0, review = 0

    lessonIds.forEach(id => {
      const saved = localStorage.getItem(`study-${id}`)
      if (saved) {
        const data = JSON.parse(saved) as StudyData
        if (data.status === 'completed') completed++
        else if (data.status === 'studying') studying++
        else if (data.status === 'review') review++
      }
    })

    setStats({ completed, studying, review, total: lessonIds.length })
  }, [lessonIds])

  if (!mounted) return null

  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xl font-bold text-gray-800">{progress}%</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-semibold">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          {stats.completed} completadas
        </span>
        <span className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-sm font-semibold">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          {stats.studying} estudiando
        </span>
        <span className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-semibold">
          <span className="w-3 h-3 rounded-full bg-orange-500"></span>
          {stats.review} repasar
        </span>
      </div>
    </div>
  )
}
