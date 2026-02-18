/**
 * PDF Processing - Extract slides as images + OCR
 */

import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

export interface ExtractedSlide {
  index: number
  imagePath: string
  ocrText: string
}

/**
 * Get page count from PDF
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  return pdfDoc.getPageCount()
}

/**
 * Extract slides from PDF as images using pdf-to-img
 */
export async function extractSlidesFromPdf(
  pdfPath: string,
  outputDir: string,
  options: { scale?: number; format?: 'png' | 'jpg' } = {}
): Promise<{ images: string[]; pageCount: number }> {
  const { pdf } = await import('pdf-to-img')
  const { scale = 2, format = 'png' } = options

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const images: string[] = []
  let pageIndex = 0

  // pdf-to-img returns an async iterator
  const document = await pdf(pdfPath, { scale })

  for await (const image of document) {
    const filename = `slide_${String(pageIndex + 1).padStart(3, '0')}.${format}`
    const outputPath = path.join(outputDir, filename)

    // Convert to desired format using sharp
    if (format === 'png') {
      await sharp(image).png().toFile(outputPath)
    } else {
      await sharp(image).jpeg({ quality: 90 }).toFile(outputPath)
    }

    images.push(outputPath)
    pageIndex++
    console.log(`Extracted slide ${pageIndex}`)
  }

  return { images, pageCount: pageIndex }
}

/**
 * Perform OCR on an image using Tesseract.js
 */
export async function performOcr(imagePath: string, language = 'spa'): Promise<string> {
  const Tesseract = await import('tesseract.js')

  try {
    const result = await Tesseract.recognize(imagePath, language, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rOCR progress: ${Math.round(m.progress * 100)}%`)
        }
      },
    })

    return result.data.text.trim()
  } catch (error) {
    console.error('OCR error:', error)
    return ''
  }
}

/**
 * Resize image for optimal OCR
 */
export async function prepareImageForOcr(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await sharp(inputPath)
    .resize(2000, null, {
      withoutEnlargement: true,
    })
    .grayscale()
    .sharpen()
    .toFile(outputPath)
}

/**
 * Process all slides: extract images + OCR
 */
export async function processSlides(
  pdfPath: string,
  outputDir: string,
  options: { runOcr?: boolean; language?: string } = {}
): Promise<ExtractedSlide[]> {
  const { runOcr = true, language = 'spa' } = options

  console.log('Extracting slides from PDF...')
  const { images, pageCount } = await extractSlidesFromPdf(pdfPath, outputDir)

  const slides: ExtractedSlide[] = []

  for (let i = 0; i < images.length; i++) {
    const imagePath = images[i]
    let ocrText = ''

    if (runOcr) {
      console.log(`\nRunning OCR on slide ${i + 1}/${pageCount}...`)
      ocrText = await performOcr(imagePath, language)
      console.log(`\n  -> Extracted ${ocrText.length} characters`)
    }

    slides.push({
      index: i,
      imagePath,
      ocrText,
    })
  }

  console.log(`\nProcessed ${slides.length} slides`)
  return slides
}

/**
 * Batch OCR multiple images with progress
 */
export async function batchOcr(
  imagePaths: string[],
  language = 'spa',
  concurrency = 2
): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  for (let i = 0; i < imagePaths.length; i += concurrency) {
    const batch = imagePaths.slice(i, i + concurrency)
    console.log(`OCR batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(imagePaths.length / concurrency)}`)

    const ocrResults = await Promise.all(
      batch.map((p) => performOcr(p, language))
    )

    batch.forEach((path, idx) => {
      results.set(path, ocrResults[idx])
    })
  }

  return results
}

/**
 * Extract just the images without OCR (faster)
 */
export async function extractPdfImages(
  pdfPath: string,
  outputDir: string
): Promise<string[]> {
  const { images } = await extractSlidesFromPdf(pdfPath, outputDir)
  return images
}
