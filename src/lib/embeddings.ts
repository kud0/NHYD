/**
 * ClassMind - Embeddings Library
 * OpenAI text-embedding-3-small for RAG system
 */

import OpenAI from 'openai'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

// Embedding model - good quality/price balance
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

// Chunk configuration
const MAX_CHUNK_TOKENS = 500 // Target chunk size
const CHUNK_OVERLAP = 50 // Overlap between chunks

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
  })
  return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  // OpenAI allows up to 2048 inputs per request
  const batchSize = 100
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map(t => t.trim())
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    })
    allEmbeddings.push(...response.data.map(d => d.embedding))
  }

  return allEmbeddings
}

/**
 * Estimate token count (rough approximation)
 * ~4 characters per token for Spanish text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Split text into chunks with overlap
 */
export function chunkText(text: string, maxTokens = MAX_CHUNK_TOKENS): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)

  let currentChunk = ''
  let currentTokens = 0

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence)

    if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim())

      // Keep overlap - last few sentences
      const overlapTokens = CHUNK_OVERLAP
      const words = currentChunk.split(' ')
      let overlap = ''
      let overlapCount = 0

      for (let i = words.length - 1; i >= 0 && overlapCount < overlapTokens; i--) {
        overlap = words[i] + ' ' + overlap
        overlapCount += estimateTokens(words[i])
      }

      currentChunk = overlap + sentence
      currentTokens = estimateTokens(currentChunk)
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
      currentTokens += sentenceTokens
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Format embedding as PostgreSQL vector literal
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, MAX_CHUNK_TOKENS }
