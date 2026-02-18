/**
 * Spaced Repetition System (SM-2 Algorithm)
 * Based on SuperMemo SM-2 algorithm
 */

export type Rating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export interface SRSCard {
  interval: number      // Days until next review
  easeFactor: number    // Difficulty multiplier (min 1.3)
  repetitions: number   // Number of successful reviews
  nextReview: Date      // Next review date
}

export interface ReviewResult extends SRSCard {
  // Updated values after review
}

const RATING_VALUES: Record<Rating, number> = {
  AGAIN: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3,
}

const MIN_EASE_FACTOR = 1.3

/**
 * Calculate next review based on SM-2 algorithm
 */
export function calculateNextReview(
  card: SRSCard,
  rating: Rating
): ReviewResult {
  const q = RATING_VALUES[rating]

  let { interval, easeFactor, repetitions } = card

  // If rating is AGAIN (0), reset the card
  if (q === 0) {
    return {
      interval: 1,
      easeFactor: Math.max(MIN_EASE_FACTOR, easeFactor - 0.2),
      repetitions: 0,
      nextReview: addMinutes(new Date(), 10), // Review in 10 minutes
    }
  }

  // Calculate new ease factor
  // EF' = EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))
  const efChange = 0.1 - (3 - q) * (0.08 + (3 - q) * 0.02)
  easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor + efChange)

  // Calculate new interval
  if (repetitions === 0) {
    interval = 1
  } else if (repetitions === 1) {
    interval = 6
  } else {
    interval = Math.round(interval * easeFactor)
  }

  // Adjust interval based on rating
  if (rating === 'HARD') {
    interval = Math.max(1, Math.round(interval * 0.8))
  } else if (rating === 'EASY') {
    interval = Math.round(interval * 1.3)
  }

  repetitions++

  return {
    interval,
    easeFactor,
    repetitions,
    nextReview: addDays(new Date(), interval),
  }
}

/**
 * Get cards due for review
 */
export function isDue(nextReview: Date): boolean {
  return new Date() >= nextReview
}

/**
 * Get interval text for display
 */
export function getIntervalText(rating: Rating, card: SRSCard): string {
  const result = calculateNextReview(card, rating)

  if (result.interval < 1) {
    return '10m'
  } else if (result.interval === 1) {
    return '1d'
  } else if (result.interval < 7) {
    return `${result.interval}d`
  } else if (result.interval < 30) {
    const weeks = Math.round(result.interval / 7)
    return `${weeks}w`
  } else if (result.interval < 365) {
    const months = Math.round(result.interval / 30)
    return `${months}mo`
  } else {
    const years = Math.round(result.interval / 365)
    return `${years}y`
  }
}

// Helper functions
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

/**
 * Calculate retention rate from review history
 */
export function calculateRetention(
  timesCorrect: number,
  timesWrong: number
): number {
  const total = timesCorrect + timesWrong
  if (total === 0) return 0
  return Math.round((timesCorrect / total) * 100)
}

/**
 * Get color for retention rate
 */
export function getRetentionColor(retention: number): string {
  if (retention >= 90) return 'text-green-500'
  if (retention >= 70) return 'text-yellow-500'
  if (retention >= 50) return 'text-orange-500'
  return 'text-red-500'
}
