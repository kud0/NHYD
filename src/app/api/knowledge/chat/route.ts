/**
 * Knowledge Chat API
 * POST /api/knowledge/chat
 *
 * Conversational AI that uses your knowledge base
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchKnowledge, buildContext } from '@/lib/knowledge'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: {
    title: string
    lessonId: string
    similarity: number
  }[]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, history = [] } = body as {
      message: string
      history: Message[]
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Search knowledge base for relevant context
    const searchResults = await searchKnowledge(message, {
      limit: 5,
      minSimilarity: 0.3,
    })

    if (searchResults.length === 0) {
      return NextResponse.json({
        response: 'No encontré información relevante en tu base de conocimiento sobre este tema.',
        sources: [],
      })
    }

    // Build context from search results
    const context = buildContext(searchResults)

    // Build conversation history for AI
    const conversationHistory = history
      .slice(-6) // Last 6 messages for context
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
      .join('\n\n')

    // Call n8n webhook for AI response
    const aiResponse = await fetch(
      process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/classmind-ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'knowledge_chat',
          message,
          context,
          conversationHistory,
          systemPrompt: `Eres un asistente de estudio que SOLO responde usando la información proporcionada de los apuntes del usuario.

REGLAS IMPORTANTES:
1. SOLO usa la información del contexto proporcionado
2. Si la información no está en el contexto, di "No tengo información sobre esto en tus apuntes"
3. Responde en español
4. Sé conciso pero completo
5. Si el usuario hace una pregunta de seguimiento, usa el historial de conversación

CONTEXTO DE LOS APUNTES:
${context}

${conversationHistory ? `HISTORIAL DE CONVERSACIÓN:\n${conversationHistory}` : ''}`,
        }),
      }
    )

    let answer = 'No pude generar una respuesta. Intenta de nuevo.'

    if (aiResponse.ok) {
      const aiData = await aiResponse.json()
      answer = aiData.response || aiData.output || aiData.answer || answer
    }

    // Format sources for response
    const sources = searchResults.map(r => ({
      title: r.title || 'Sin título',
      lessonId: r.lessonId,
      similarity: r.similarity,
      preview: r.content.slice(0, 150) + '...',
    }))

    return NextResponse.json({
      response: answer,
      sources,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Chat failed' },
      { status: 500 }
    )
  }
}
