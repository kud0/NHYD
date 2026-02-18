/**
 * Transcription via RunPod Whisper API
 */

const RUNPOD_API_URL = process.env.RUNPOD_API_URL || ''
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || ''

export interface TranscriptWord {
  word: string
  start: number
  end: number
  confidence: number
}

export interface TranscriptSegment {
  id: number
  text: string
  start: number
  end: number
  words?: TranscriptWord[]
}

export interface TranscriptResult {
  text: string
  segments: TranscriptSegment[]
  language: string
  duration: number
}

interface RunPodResponse {
  id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  output?: TranscriptResult
  error?: string
}

/**
 * Submit audio for transcription
 */
export async function submitTranscription(
  audioUrl: string
): Promise<{ jobId: string } | { error: string }> {
  if (!RUNPOD_API_URL || !RUNPOD_API_KEY) {
    return { error: 'RunPod API not configured' }
  }

  try {
    const response = await fetch(`${RUNPOD_API_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          audio: audioUrl,
          model: 'large-v3',
          language: 'es', // Spanish
          word_timestamps: true,
          task: 'transcribe',
        },
      }),
    })

    const data = await response.json()

    if (data.id) {
      return { jobId: data.id }
    }

    return { error: data.error || 'Failed to submit transcription' }
  } catch (error) {
    console.error('Transcription submit error:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Check transcription status
 */
export async function checkTranscriptionStatus(
  jobId: string
): Promise<RunPodResponse> {
  if (!RUNPOD_API_URL || !RUNPOD_API_KEY) {
    return { id: jobId, status: 'FAILED', error: 'RunPod API not configured' }
  }

  try {
    const response = await fetch(`${RUNPOD_API_URL}/status/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    })

    return await response.json()
  } catch (error) {
    console.error('Transcription status error:', error)
    return {
      id: jobId,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Wait for transcription to complete (with polling)
 */
export async function waitForTranscription(
  jobId: string,
  maxWaitMs: number = 600000, // 10 minutes max
  pollIntervalMs: number = 5000
): Promise<TranscriptResult | { error: string }> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkTranscriptionStatus(jobId)

    if (status.status === 'COMPLETED' && status.output) {
      return status.output
    }

    if (status.status === 'FAILED') {
      return { error: status.error || 'Transcription failed' }
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  return { error: 'Transcription timed out' }
}

/**
 * Convert segments to chunks for storage
 */
export function segmentsToChunks(
  segments: TranscriptSegment[],
  chunkDurationSeconds: number = 30
): { text: string; startTime: number; endTime: number }[] {
  const chunks: { text: string; startTime: number; endTime: number }[] = []

  let currentChunk = {
    text: '',
    startTime: 0,
    endTime: 0,
  }

  for (const segment of segments) {
    if (currentChunk.text === '') {
      currentChunk.startTime = segment.start
    }

    currentChunk.text += (currentChunk.text ? ' ' : '') + segment.text
    currentChunk.endTime = segment.end

    // Check if chunk duration exceeded
    if (currentChunk.endTime - currentChunk.startTime >= chunkDurationSeconds) {
      chunks.push({ ...currentChunk })
      currentChunk = { text: '', startTime: 0, endTime: 0 }
    }
  }

  // Push remaining chunk
  if (currentChunk.text) {
    chunks.push(currentChunk)
  }

  return chunks
}

/**
 * Mock transcription for development (when RunPod not configured)
 */
export function mockTranscription(durationSeconds: number): TranscriptResult {
  const segmentCount = Math.ceil(durationSeconds / 30)
  const segments: TranscriptSegment[] = []

  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      id: i,
      text: `[Segment ${i + 1}] Este es un texto de ejemplo para desarrollo. Aquí iría el contenido transcrito del audio.`,
      start: i * 30,
      end: Math.min((i + 1) * 30, durationSeconds),
    })
  }

  return {
    text: segments.map(s => s.text).join(' '),
    segments,
    language: 'es',
    duration: durationSeconds,
  }
}
