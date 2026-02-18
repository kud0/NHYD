import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { saveUploadedFile, moveToStorage } from '@/lib/storage'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

type RouteContext = {
  params: Promise<{ lessonId: string }>
}

// POST /api/lessons/[lessonId]/upload - Upload audio and/or PDF
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { lessonId } = await context.params

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { subject: true }
    })

    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const pdfFile = formData.get('pdf') as File | null

    if (!audioFile && !pdfFile) {
      return NextResponse.json(
        { error: 'At least one file (audio or pdf) is required' },
        { status: 400 }
      )
    }

    const results: {
      audio?: { path: string; size: number }
      pdf?: { path: string; size: number; pageCount?: number }
    } = {}

    const storageBase = process.env.STORAGE_PATH || '../storage'

    // Process audio file
    if (audioFile) {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
      const audioDir = path.join(storageBase, 'audio', lesson.subjectId, lessonId)

      if (!existsSync(audioDir)) {
        await mkdir(audioDir, { recursive: true })
      }

      const audioPath = path.join(audioDir, 'audio' + path.extname(audioFile.name))
      await writeFile(audioPath, audioBuffer)

      // Create AudioPart record for this audio file
      await prisma.audioPart.create({
        data: {
          title: 'Audio Principal',
          order: 0,
          audioPath,
          lessonId,
        }
      })

      results.audio = {
        path: audioPath,
        size: audioBuffer.length
      }
    }

    // Process PDF file
    if (pdfFile) {
      const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
      const slidesDir = path.join(storageBase, 'slides', lesson.subjectId, lessonId)

      if (!existsSync(slidesDir)) {
        await mkdir(slidesDir, { recursive: true })
      }

      const pdfPath = path.join(slidesDir, 'slides.pdf')
      await writeFile(pdfPath, pdfBuffer)

      // Get page count (basic approach)
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pageCount = pdfDoc.getPageCount()

      results.pdf = {
        path: pdfPath,
        size: pdfBuffer.length,
        pageCount
      }

      // Create placeholder slides in DB
      // (Actual extraction would happen in processing job)
      for (let i = 0; i < pageCount; i++) {
        await prisma.slide.create({
          data: {
            lessonId,
            order: i,
            imagePath: `${slidesDir}/slide_${String(i + 1).padStart(3, '0')}.png`,
            ocrText: null // Will be filled during processing
          }
        })
      }
    }

    // Update lesson status to PENDING (ready for processing)
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { status: 'PENDING' }
    })

    return NextResponse.json({
      success: true,
      lessonId,
      uploaded: results,
      message: 'Files uploaded. Ready for processing.'
    })
  } catch (error) {
    console.error('Error uploading files:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    )
  }
}
