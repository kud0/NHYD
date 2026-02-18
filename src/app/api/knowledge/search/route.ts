/**
 * Knowledge Search API
 * POST /api/knowledge/search
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchKnowledge, buildContext, getIndexStats } from '@/lib/knowledge'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, limit = 10, filters = {}, includeAnswer = true } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Search knowledge base
    const results = await searchKnowledge(query, {
      limit,
      sourceTypes: filters.sourceTypes,
      subjectId: filters.subjectId,
      lessonId: filters.lessonId,
      programId: filters.programId,
      minSimilarity: filters.minSimilarity || 0.5,
    })

    let answer = null

    // Generate AI answer if requested and results found
    if (includeAnswer && results.length > 0) {
      const context = buildContext(results)

      // Call n8n webhook for AI response
      const aiResponse = await fetch(
        process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/classmind-ai',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'knowledge_search',
            query,
            context,
            sources: results.map((r, i) => ({
              index: i + 1,
              type: r.sourceType,
              title: r.title,
              lessonId: r.lessonId,
              similarity: r.similarity,
            })),
          }),
        }
      )

      if (aiResponse.ok) {
        const aiData = await aiResponse.json()
        answer = aiData.response || aiData.output || aiData.answer
      }
    }

    return NextResponse.json({
      query,
      results: results.map(r => ({
        id: r.id,
        content: r.content.slice(0, 500) + (r.content.length > 500 ? '...' : ''),
        similarity: r.similarity,
        sourceType: r.sourceType,
        lessonId: r.lessonId,
        subjectId: r.subjectId,
        title: r.title,
      })),
      answer,
      totalResults: results.length,
    })
  } catch (error) {
    console.error('Knowledge search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const stats = await getIndexStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}
