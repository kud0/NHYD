/**
 * AI Integration via n8n webhook
 * Sends requests to n8n which uses Claude via SSH
 */

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/classmind-ai'

export type AIAction =
  | 'match_slides'      // Match transcript chunks to slides
  | 'generate_summary'  // Generate lesson summary
  | 'generate_flashcards' // Generate flashcards from content
  | 'generate_quiz'     // Generate quiz questions
  | 'explain_concept'   // Tutor: explain a concept
  | 'answer_question'   // Tutor: answer a question

interface AIRequest {
  action: AIAction
  data: Record<string, unknown>
  context?: string
}

interface AIResponse<T = unknown> {
  success: boolean
  result?: T
  error?: string
}

export async function callAI<T = unknown>(request: AIRequest): Promise<AIResponse<T>> {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`)
    }

    const data = await response.json()
    return { success: true, result: data as T }
  } catch (error) {
    console.error('AI call error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Specific AI functions

export interface SlideMatch {
  slideIndex: number
  transcriptChunkIndex: number
  confidence: number
  reasoning?: string
}

export async function matchSlidesToTranscript(
  slides: { index: number; ocrText: string }[],
  transcriptChunks: { index: number; text: string; startTime: number; endTime: number }[]
): Promise<SlideMatch[]> {
  const response = await callAI<SlideMatch[]>({
    action: 'match_slides',
    data: { slides, transcriptChunks },
    context: 'Nutrition university lecture in Spanish',
  })

  return response.result || []
}

export interface GeneratedSummary {
  content: string
  keyPoints: string[]
}

export async function generateSummary(
  transcript: string,
  slideTexts: string[]
): Promise<GeneratedSummary | null> {
  const response = await callAI<GeneratedSummary>({
    action: 'generate_summary',
    data: { transcript, slideTexts },
    context: 'Nutrition university lecture in Spanish',
  })

  return response.result || null
}

export interface GeneratedFlashcard {
  front: string
  back: string
  type: 'CONCEPT' | 'DEFINITION' | 'PROCESS' | 'FACT'
}

export async function generateFlashcards(
  content: string,
  maxCards: number = 10
): Promise<GeneratedFlashcard[]> {
  const response = await callAI<GeneratedFlashcard[]>({
    action: 'generate_flashcards',
    data: { content, maxCards },
    context: 'Nutrition university lecture in Spanish',
  })

  return response.result || []
}

export interface GeneratedQuestion {
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER'
  question: string
  options: string[]
  correct: string
  explanation: string
}

export async function generateQuiz(
  content: string,
  questionCount: number = 5
): Promise<GeneratedQuestion[]> {
  const response = await callAI<GeneratedQuestion[]>({
    action: 'generate_quiz',
    data: { content, questionCount },
    context: 'Nutrition university exam questions in Spanish',
  })

  return response.result || []
}

export async function explainConcept(
  concept: string,
  context: string
): Promise<string> {
  const response = await callAI<{ explanation: string }>({
    action: 'explain_concept',
    data: { concept, context },
  })

  return response.result?.explanation || 'Unable to generate explanation'
}
