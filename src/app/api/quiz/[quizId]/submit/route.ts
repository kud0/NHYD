import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type RouteContext = {
  params: Promise<{ quizId: string }>
}

interface SubmitBody {
  answers: Record<string, string> // questionId -> selected answer
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { quizId } = await context.params
    const body: SubmitBody = await request.json()

    // Get quiz with correct answers
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          select: {
            id: true,
            question: true,
            correct: true,
            explanation: true,
            options: true,
          },
        },
      },
    })

    if (!quiz) {
      return NextResponse.json(
        { error: 'Quiz not found' },
        { status: 404 }
      )
    }

    // Calculate score and create attempt
    let correctCount = 0
    const results: {
      questionId: string
      question: string
      userAnswer: string
      correctAnswer: string
      isCorrect: boolean
      explanation: string | null
      options: string[]
    }[] = []

    for (const q of quiz.questions) {
      const userAnswer = body.answers[q.id] || ''
      const isCorrect = userAnswer === q.correct

      if (isCorrect) correctCount++

      results.push({
        questionId: q.id,
        question: q.question,
        userAnswer,
        correctAnswer: q.correct,
        isCorrect,
        explanation: q.explanation,
        options: q.options,
      })
    }

    const score = (correctCount / quiz.questions.length) * 100

    // Create attempt record
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        score,
        completed: true,
        completedAt: new Date(),
        answers: {
          create: results.map(r => ({
            questionId: r.questionId,
            answer: r.userAnswer,
            isCorrect: r.isCorrect,
          })),
        },
      },
    })

    return NextResponse.json({
      attemptId: attempt.id,
      score,
      correctCount,
      totalQuestions: quiz.questions.length,
      passed: score >= quiz.passThreshold,
      results,
    })
  } catch (error) {
    console.error('Error submitting quiz:', error)
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    )
  }
}
