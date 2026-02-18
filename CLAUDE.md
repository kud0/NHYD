# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClassMind - Study platform for nutrition students. Transforms lecture recordings (audio + PDF slides) into interactive study materials with AI-generated summaries, quizzes, flashcards, and a RAG-powered knowledge base.

All UI content is in Spanish.

## CRITICAL: Data Safety

**NHYD** = University (Nutrición Humana y Dietética) - THE PRIMARY CONTENT (irreplaceable academic data)
**CPE** = Certificate (Certificado Personal Trainer) - Secondary

NEVER delete NHYD data, reset the database without explicit permission, or create duplicate RunPod jobs (costs money).

## Permissions

Full permissions granted. Run commands directly without asking.

## Commands

All commands run from `src/` (the Next.js app directory):

```bash
# Development
cd src && npm run dev          # Start dev server
cd src && npm run build        # Build for production
cd src && npm run lint         # ESLint

# Database
cd src && npx prisma migrate dev    # Run migrations
cd src && npx prisma generate       # Regenerate client after schema changes
cd src && npx prisma studio         # Visual DB browser

# Docker (from project root)
docker compose up -d           # Start PostgreSQL

# Processing scripts (from project root)
npx tsx scripts/process-subject.ts "NHYD - XX Subject" [tunnel-url]
npx tsx scripts/add-summaries.ts
npx tsx scripts/generate-full-cornell.ts    # Main Cornell notes generator (30K+ chars)
npx tsx scripts/transcribe-all.ts           # Batch transcription via RunPod
npx tsx scripts/import-transcripts.ts       # Import transcript JSONs to DB
npx tsx scripts/status-report.ts            # Full status check
```

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **PostgreSQL 16** (Docker) + **Prisma 5** ORM
- **AI**: n8n webhook (`127.0.0.1:5678/webhook/classmind-ai`) routes to Claude CLI
- **Transcription**: RunPod Whisper API (large-v3, Spanish)
- **PDF**: pdf-to-img + sharp (slide extraction), Tesseract.js (OCR, `spa` language)
- **SRS**: SM-2 algorithm implementation for flashcard spacing

## Architecture

### Directory Layout

- `src/` - Next.js app (this is the working directory for npm commands)
- `src/prisma/schema.prisma` - Database schema (NOT at project root)
- `src/app/` - App Router pages and API routes
- `src/lib/` - Core business logic modules
- `src/components/` - Shared React components
- `storage/` - Filesystem media (audio/, slides/, uploads/) - served via `/api/storage/[...path]`
- `scripts/` - Processing and download scripts (excluded from tsconfig)

### Data Model Hierarchy

`Program → Subject → Lesson → (AudioPart[], Slide[], Summary, Flashcard[], Quiz[])`

A Lesson has multiple AudioParts (multi-part lectures). Each AudioPart has TranscriptChunks. Slides are matched to TranscriptChunks via TranscriptMatch (with confidence scores). The KnowledgeChunk model powers the RAG system with hybrid text + embedding search.

### Lib Modules (`src/lib/`)

- `db/` - Prisma client singleton (global caching for dev HMR)
- `ai/` - n8n webhook client. All AI calls go through `callAI()` with action types: `match_slides`, `generate_summary`, `generate_flashcards`, `generate_quiz`, `explain_concept`, `answer_question`
- `storage/` - Filesystem operations. Files stored as `storage/{audio|slides}/{subjectId}/{lessonId}/`. Public URLs via `/api/storage/...`
- `transcription/` - RunPod Whisper integration with submit/poll/wait pattern. `segmentsToChunks()` converts transcript segments into 30-second chunks
- `pdf/` - PDF slide extraction (pdf-to-img → sharp) + OCR (Tesseract.js). `processSlides()` is the main pipeline
- `srs/` - SM-2 spaced repetition algorithm. `calculateNextReview()` is the core function
- `knowledge.ts` + `embeddings.ts` - RAG system. Hybrid search (text + semantic via cosine similarity). Embeddings stored as JSONB in knowledge_chunks table

### API Routes (`src/app/api/`)

- `/api/programs/` - CRUD for programs
- `/api/subjects/` - CRUD for subjects
- `/api/lessons/[lessonId]/` - Lesson details, upload, slides, annotations, tutor, cornell notes
- `/api/lessons/[lessonId]/generate-quiz` - On-demand quiz generation
- `/api/quiz/[quizId]/` - Quiz data and submission
- `/api/storage/[...path]` - Static file serving from `storage/`
- `/api/knowledge/search` + `/api/knowledge/chat` - RAG search and AI chat
- `/api/knowledge/saved` - Saved Q&A history

### Key Pages

- `/` - Dashboard with program cards and stats
- `/programs/[programId]` - Subject listing
- `/subjects/[subjectId]` - Lesson listing
- `/lessons/[lessonId]` - Lesson detail
- `/lessons/[lessonId]/study` - Slide-by-slide study mode
- `/lessons/[lessonId]/cornell` - Cornell notes view
- `/quiz/[quizId]` - Quiz with timer
- `/ask` - RAG-powered AI chat
- `/saved` - Saved Q&A history

### Path Alias

`@/*` maps to `src/*` (configured in tsconfig.json). Import as `@/lib/db`, `@/components/...`, etc.

## Code Guidelines

- **Use `127.0.0.1`** instead of `localhost` for n8n webhook (fetch issues on macOS)
- **Check `scripts/` first** before creating new scripts - many processing utilities already exist
- **Don't create test/debug scripts** - delete them after debugging
- **Keep scripts in `scripts/`** - not in root
- **Summaries format**: PUNTOS CLAVE (bullet points) + EN UNA FRASE (one-line summary)
- **Cornell notes** should be >10K chars (ideally 30K+)
- **File naming** for CPE media: `Clase-X[-Parte-Y]-[DESCRIPTIVE_TITLE]-[TYPE].[ext]` (see NAMING_CONVENTION.md)
- **Quiz generation** is built-in via API: `POST /api/lessons/[id]/generate-quiz`
