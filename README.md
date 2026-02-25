# Funny Photo Story

AI workflow orchestration system for generating structured, multi-stage comic stories from photo collections. Built as an architectural exploration of LLM provider abstraction, structured extraction pipelines, and backend-driven content orchestration.

**Live demo:** https://social-ai-poc.vercel.app/

---

## Overview

This project is not about UI polish — it is an architectural exploration of:

- LLM-driven structured extraction with typed output validation
- Provider abstraction across OpenAI and Anthropic
- Multi-step workflow orchestration with clear failure boundaries
- Reliable API design and data modeling
- Evaluation-ready prompt and schema boundaries

Photos are grouped into **rooms**. A generation request triggers a three-stage pipeline — beats, panels, narrative — producing a typed, validated story artifact. Stories can be published via a unique slug for public access.

```
Photos → [Caption Pass] → Beat Generation → Panel Layout → Narrative → Story (READY)
```

---

## Architectural Themes

### 1. Workflow Orchestration

`POST /api/story` owns the full generation lifecycle:

1. **Caption pass** — Optional OpenAI vision call to attach semantic captions to photos. Non-fatal; pipeline continues on failure.
2. **Beat generation** — Produces a `Beat[]` array mapping story moments to specific photos.
3. **Panel layout** — Transforms beats into `Panel[]` with composition and dialogue instructions.
4. **Narrative** — Generates prose from the panel sequence.

Each stage is independently validated against Zod schemas before any downstream consumption. Results are written to typed JSON columns (`beatsJson`, `panelMap`), keeping the artifact self-contained. Story status tracks the full lifecycle: `PENDING → PROCESSING → READY | ERROR`.

The pipeline is designed to isolate stages to allow provider swapping, deterministic testing, clear failure boundaries, and future observability hooks.

### 2. Provider Abstraction Layer

The AI layer is built around a `StoryProvider` interface, decoupling pipeline logic from any specific model or vendor. Provider resolution is automatic based on available credentials:

```
OpenAI → Anthropic → Mock
```

Each provider implements the same `genBeats`, `genPanels`, and `genNarrative` contracts. Model selection is driven by a **quality preset system** (`fast / balanced / premium`) mapping to concrete model IDs via environment config — enabling vendor experimentation, cost/latency tradeoff analysis, and controlled prompt evolution without touching business logic.

Structured output is normalized through `safeJson()` (strips LLM code fences) and validated with shared schemas before any downstream use.

### 3. Data Modeling and Persistence

Four core entities: `User`, `Room`, `Photo`, `Story`.

- **Room** — Groups photos under a short, uppercase code. Entry point for all generation.
- **Photo** — References a Cloudinary asset. Stores optional AI-generated captions.
- **Story** — Owns the full generation artifact (`beatsJson`, `panelMap`, `narrative`), status lifecycle, and optional `shareSlug` for public access.
- **shareSlug** — Unique index enabling a fully public read path without authentication.

Row-Level Security (RLS) is enabled on all tables for isolation at the database layer.

### 4. Media Ingestion

Uploads bypass the application server entirely. The client fetches a short-lived signed credential from `GET /api/sign` and uploads directly to Cloudinary. The server only handles the metadata record after the fact — keeping the upload path fast and the server stateless with respect to binary data.

### 5. Access Control

A cookie-based middleware (`site_access=granted`) gates all routes. Public surface is intentionally minimal: `/unlock`, `/s/*`, and `/api/story/by-slug/*`. All other routes require the cookie, enforced at the edge.

---

## Why This Exists

This project explores how AI systems should be structured when treated as infrastructure rather than novelty.

Key questions examined:

- How should LLM output be parsed and validated safely at each pipeline stage?
- What abstractions prevent vendor lock-in while preserving cost and latency flexibility?
- Where do failure domains live in a multi-step generation workflow?
- How should prompt boundaries be isolated to enable deterministic testing?
- How do you model AI-generated artifacts in a relational schema without losing structure?

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Supabase + RLS) |
| ORM | Prisma |
| LLM Providers | OpenAI, Anthropic |
| Output Validation | Zod |
| Media CDN | Cloudinary |
| Styling | Tailwind CSS |
| Testing | Vitest, React Testing Library |
| Deployment | Vercel |

---

## API Surface

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sign` | Issue signed Cloudinary upload credential |
| `POST` | `/api/photos` | Persist uploaded photo record |
| `POST` | `/api/story` | Run full generation pipeline |
| `GET` | `/api/story/[id]` | Fetch story by ID |
| `POST` | `/api/story/[id]/share` | Assign public share slug |
| `GET` | `/api/story/by-slug/[slug]` | Fetch story by slug (public, no auth) |
| `POST` | `/api/rooms` | Create room |

---

## Setup

### Prerequisites

- Node.js 20+, pnpm
- PostgreSQL (Supabase or local)
- OpenAI and/or Anthropic API key
- Cloudinary account (signed upload preset required)

### Installation

```bash
pnpm install
pnpm prisma migrate dev
```

### Environment Variables

```env
DATABASE_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=     # Must be a signed preset
CLOUDINARY_FOLDER=            # Default: social-ai-poc

OPENAI_API_KEY=               # At least one AI provider required
ANTHROPIC_API_KEY=

UNLOCK_PASSWORD=
```

Model configuration (optional — overrides quality preset defaults):

```env
OPENAI_MODEL_FAST=
OPENAI_MODEL_BALANCED=
OPENAI_MODEL_PREMIUM=
ANTHROPIC_MODEL_FAST=
ANTHROPIC_MODEL_BALANCED=
ANTHROPIC_MODEL_PREMIUM=
```

### Commands

```bash
pnpm dev                  # Start dev server (localhost:3000)
pnpm build                # Production build
pnpm lint                 # ESLint

pnpm test                 # Run test suite
pnpm test:watch           # Watch mode
pnpm test:coverage        # Coverage report

pnpm prisma generate      # Regenerate Prisma client after schema changes
pnpm prisma studio        # Database GUI
pnpm migrate:prod         # Run migrations against production
```

---

## Future Directions

- Async job orchestration layer with retry and idempotency guarantees
- Evaluation scoring framework for LLM output quality
- Observability and tracing for multi-step LLM calls
- Embedding-backed retrieval for context reconstruction
- Multi-tenant cost attribution

---

## Status

Actively evolving architectural sandbox focused on AI backend reliability and orchestration patterns.

---

## License

MIT
