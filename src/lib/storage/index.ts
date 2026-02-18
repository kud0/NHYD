/**
 * Storage utilities for audio and slide files
 */

import { mkdir, writeFile, readFile, unlink, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_BASE = process.env.STORAGE_PATH || '../storage'

export const STORAGE_PATHS = {
  audio: path.join(STORAGE_BASE, 'audio'),
  slides: path.join(STORAGE_BASE, 'slides'),
  uploads: path.join(STORAGE_BASE, 'uploads'),
}

/**
 * Ensure storage directories exist
 */
export async function ensureStorageDirs(): Promise<void> {
  for (const dir of Object.values(STORAGE_PATHS)) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
  }
}

/**
 * Get path for lesson storage
 */
export function getLessonStoragePath(
  type: 'audio' | 'slides',
  subjectId: string,
  lessonId: string
): string {
  return path.join(STORAGE_PATHS[type], subjectId, lessonId)
}

/**
 * Save uploaded file
 */
export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string
): Promise<{ path: string; filename: string }> {
  await ensureStorageDirs()

  const ext = path.extname(originalName)
  const filename = `${uuidv4()}${ext}`
  const filePath = path.join(STORAGE_PATHS.uploads, filename)

  await writeFile(filePath, buffer)

  return { path: filePath, filename }
}

/**
 * Move file from uploads to permanent storage
 */
export async function moveToStorage(
  uploadPath: string,
  type: 'audio' | 'slides',
  subjectId: string,
  lessonId: string,
  filename: string
): Promise<string> {
  const destDir = getLessonStoragePath(type, subjectId, lessonId)

  if (!existsSync(destDir)) {
    await mkdir(destDir, { recursive: true })
  }

  const destPath = path.join(destDir, filename)
  const buffer = await readFile(uploadPath)
  await writeFile(destPath, buffer)

  // Clean up upload
  await unlink(uploadPath)

  return destPath
}

/**
 * Save slide image
 */
export async function saveSlideImage(
  buffer: Buffer,
  subjectId: string,
  lessonId: string,
  slideNumber: number
): Promise<string> {
  const destDir = getLessonStoragePath('slides', subjectId, lessonId)

  if (!existsSync(destDir)) {
    await mkdir(destDir, { recursive: true })
  }

  const filename = `slide_${slideNumber.toString().padStart(3, '0')}.png`
  const filePath = path.join(destDir, filename)

  await writeFile(filePath, buffer)

  return filePath
}

/**
 * Get all slide images for a lesson
 */
export async function getSlideImages(
  subjectId: string,
  lessonId: string
): Promise<string[]> {
  const dir = getLessonStoragePath('slides', subjectId, lessonId)

  if (!existsSync(dir)) {
    return []
  }

  const files = await readdir(dir)
  return files
    .filter(f => f.startsWith('slide_') && f.endsWith('.png'))
    .sort()
    .map(f => path.join(dir, f))
}

/**
 * Get public URL for a file (for serving via API)
 */
export function getPublicUrl(filePath: string): string {
  // Convert absolute path to relative URL
  const relativePath = filePath.replace(STORAGE_BASE, '')
  return `/api/storage${relativePath}`
}

/**
 * Clean up lesson storage
 */
export async function cleanupLessonStorage(
  subjectId: string,
  lessonId: string
): Promise<void> {
  const audioDir = getLessonStoragePath('audio', subjectId, lessonId)
  const slidesDir = getLessonStoragePath('slides', subjectId, lessonId)

  // Note: Would need rimraf or fs.rm for recursive delete
  // For now, just log
  console.log(`Would clean up: ${audioDir}, ${slidesDir}`)
}
