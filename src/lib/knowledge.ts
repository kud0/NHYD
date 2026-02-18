/**
 * ClassMind - Knowledge Base Library
 * RAG search and retrieval functions
 */

import { prisma } from './db'
import { generateEmbedding, cosineSimilarity, chunkText, estimateTokens } from './embeddings'

export interface SearchResult {
  id: string
  content: string
  similarity: number
  sourceType: string
  sourceId: string
  lessonId: string | null
  subjectId: string | null
  title: string | null
  tags: string[]
}

export interface SearchOptions {
  limit?: number
  sourceTypes?: string[]
  subjectId?: string
  lessonId?: string
  programId?: string
  minSimilarity?: number
}

/**
 * Search knowledge base by hybrid search (text + semantic)
 */
export async function searchKnowledge(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 10,
    sourceTypes,
    subjectId,
    lessonId,
    programId,
    minSimilarity = 0.2,  // Lower threshold for semantic
  } = options

  // Build where clause for filtering
  const where: Record<string, unknown> = {}
  if (sourceTypes?.length) {
    where.sourceType = { in: sourceTypes }
  }
  if (subjectId) {
    where.subjectId = subjectId
  }
  if (lessonId) {
    where.lessonId = lessonId
  }
  if (programId) {
    where.programId = programId
  }

  const results = new Map<string, SearchResult>()

  // 1. TEXT SEARCH - Find direct text matches (great for partial words)
  const textMatches = await prisma.knowledgeChunk.findMany({
    where: {
      ...where,
      OR: [
        { content: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      content: true,
      sourceType: true,
      sourceId: true,
      lessonId: true,
      subjectId: true,
      title: true,
      tags: true,
    },
    take: limit * 2,
  })

  // Add text matches with high similarity (text match = very relevant)
  for (const chunk of textMatches) {
    const titleMatch = chunk.title?.toLowerCase().includes(query.toLowerCase())
    results.set(chunk.id, {
      ...chunk,
      similarity: titleMatch ? 0.95 : 0.85,  // Title matches score higher
    })
  }

  // 2. SEMANTIC SEARCH - If we don't have enough results, do semantic search
  if (results.size < limit) {
    try {
      const queryEmbedding = await generateEmbedding(query)

      // Fetch chunks with embeddings
      const chunks = await prisma.knowledgeChunk.findMany({
        where,
        select: {
          id: true,
          content: true,
          sourceType: true,
          sourceId: true,
          lessonId: true,
          subjectId: true,
          title: true,
          tags: true,
        },
        take: 500,  // Limit for performance
      })

      const chunkIds = chunks.filter(c => !results.has(c.id)).map(c => c.id)

      if (chunkIds.length > 0) {
        const embeddings = await prisma.$queryRawUnsafe<{ id: string; embedding: number[] }[]>(
          `SELECT id, embedding FROM knowledge_chunks WHERE id = ANY($1) AND embedding IS NOT NULL`,
          chunkIds
        )

        const embeddingMap = new Map(embeddings.map(e => [e.id, e.embedding]))

        for (const chunk of chunks) {
          if (results.has(chunk.id)) continue
          const embedding = embeddingMap.get(chunk.id)
          if (!embedding) continue

          const similarity = cosineSimilarity(queryEmbedding, embedding)
          if (similarity >= minSimilarity) {
            results.set(chunk.id, { ...chunk, similarity })
          }
        }
      }
    } catch (e) {
      console.error('Semantic search error:', e)
      // Continue with text results only
    }
  }

  // Sort by similarity and return top results
  return Array.from(results.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

/**
 * Index content into knowledge base
 */
export async function indexContent(
  content: string,
  metadata: {
    sourceType: string
    sourceId: string
    lessonId?: string
    subjectId?: string
    programId?: string
    title?: string
    tags?: string[]
  }
): Promise<string[]> {
  const { sourceType, sourceId, lessonId, subjectId, programId, title, tags = [] } = metadata

  // Check if already indexed
  const existing = await prisma.knowledgeChunk.findFirst({
    where: { sourceType, sourceId },
  })
  if (existing) {
    console.log(`Content already indexed: ${sourceType}/${sourceId}`)
    return []
  }

  // Split into chunks
  const chunks = chunkText(content)
  const chunkIds: string[] = []

  for (const chunkContent of chunks) {
    // Generate embedding
    const embedding = await generateEmbedding(chunkContent)

    // Create chunk record
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        content: chunkContent,
        sourceType,
        sourceId,
        lessonId,
        subjectId,
        programId,
        title,
        tags,
        tokenCount: estimateTokens(chunkContent),
      },
    })

    // Store embedding via raw SQL (JSONB)
    await prisma.$executeRaw`
      UPDATE knowledge_chunks
      SET embedding = ${JSON.stringify(embedding)}::jsonb
      WHERE id = ${chunk.id}
    `

    chunkIds.push(chunk.id)
  }

  return chunkIds
}

/**
 * Delete indexed content by source
 */
export async function deleteIndexedContent(
  sourceType: string,
  sourceId: string
): Promise<number> {
  const result = await prisma.knowledgeChunk.deleteMany({
    where: { sourceType, sourceId },
  })
  return result.count
}

/**
 * Get indexing statistics
 */
export async function getIndexStats(): Promise<{
  totalChunks: number
  bySourceType: Record<string, number>
  byProgram: Record<string, number>
}> {
  const totalChunks = await prisma.knowledgeChunk.count()

  const bySourceType = await prisma.knowledgeChunk.groupBy({
    by: ['sourceType'],
    _count: true,
  })

  const byProgram = await prisma.knowledgeChunk.groupBy({
    by: ['programId'],
    _count: true,
  })

  return {
    totalChunks,
    bySourceType: Object.fromEntries(
      bySourceType.map(s => [s.sourceType, s._count])
    ),
    byProgram: Object.fromEntries(
      byProgram.filter(p => p.programId).map(p => [p.programId!, p._count])
    ),
  }
}

/**
 * Build context from search results for AI prompt
 */
export function buildContext(results: SearchResult[]): string {
  return results
    .map((r, i) => {
      const source = r.title || `${r.sourceType}/${r.sourceId}`
      return `[${i + 1}] (${source}, relevancia: ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`
    })
    .join('\n\n---\n\n')
}
