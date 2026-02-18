/**
 * Saved Q&A API
 * POST /api/knowledge/saved - Save a Q&A
 * GET /api/knowledge/saved - List saved Q&As
 * DELETE /api/knowledge/saved?id=xxx - Delete a saved Q&A
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - List all saved Q&As
export async function GET() {
  try {
    const saved = await prisma.savedQA.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ items: saved })
  } catch (error) {
    console.error('Failed to fetch saved Q&As:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved Q&As' },
      { status: 500 }
    )
  }
}

// POST - Save a new Q&A
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, answer, sources } = body

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 }
      )
    }

    const saved = await prisma.savedQA.create({
      data: {
        question,
        answer,
        sources: sources || [],
      },
    })

    return NextResponse.json({ item: saved })
  } catch (error) {
    console.error('Failed to save Q&A:', error)
    return NextResponse.json(
      { error: 'Failed to save Q&A' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a saved Q&A
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    await prisma.savedQA.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete Q&A:', error)
    return NextResponse.json(
      { error: 'Failed to delete Q&A' },
      { status: 500 }
    )
  }
}
