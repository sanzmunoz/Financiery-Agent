# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: FinBot — Bilingual Financial AI Chatbot

FinBot is a full-stack AI chatbot combining RAG (semantic search), semantic caching, voice/image input, and external tools. It is a stateless three-tier system: vanilla JS frontend + FastAPI backend + n8n Cloud orchestration.

---

## Setup

```bash
# Create and activate Python venv
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

pip install -r backend/requirements.txt

# Configure secrets — fill in API keys:
# backend/.env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, N8N_WEBHOOK_URL
# scripts/.env: same minus N8N_WEBHOOK_URL

# One-time database setup: run supabase/schema.sql in the Supabase SQL Editor

# Populate RAG index and seed cache (one-time)
python scripts/populate_rag.py
python scripts/seed_cache.py
```

## Development Commands

```bash
# Backend (auto-reload)
cd backend && fastapi dev src/main.py     # http://localhost:8000

# Frontend (recommended — avoids CORS issues with file://)
npx serve frontend                        # http://localhost:3000

# Health check
curl http://localhost:8000/health

# Test chat endpoint
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola","messages":[],"image":null,"mode":"text"}'
```

---

## Architecture

### System Design (3-Tier Stateless)

```
Frontend (Vanilla JS)
  └─ POST /api/chat, /api/transcribe
       ↓
FastAPI Backend (stateless)
  ├─ Semantic cache check (pgvector cosine similarity, threshold 0.90)
  ├─ n8n Cloud webhook call (60s timeout)
  └─ TTS → base64 MP3 if mode=audio
       ↓                    ↓
  Supabase (pgvector)    n8n Cloud → OpenAI GPT-4o-mini / Whisper / TTS
```

### Request → Response Data Flow

1. Frontend sends `POST /api/chat` with `{message, messages[], image, mode}` (last 7 messages only).
2. Backend embeds message with `text-embedding-3-small` and checks `semantic_cache` (cosine similarity ≥ 0.90). Cache hit → return immediately with ⚡ badge.
3. Cache miss → backend calls n8n webhook with message + serialized 7-message history.
4. n8n detects language (ES/EN), then branches:
   - **Image present**: Vision branch → `gpt-4o-mini` with base64 image.
   - **No image**: Agent branch → `gpt-4o-mini` with tools: `RAG`, `calculate_interest`, `get_usd_rate`, `currency_convert`.
5. Backend stores response in cache only if: no image AND no tool used (real-time data must not be cached).
6. If `mode=audio`, backend calls OpenAI TTS → returns `data:audio/mpeg;base64,...`.
7. Frontend renders message with badges (cache hit, tool name, latency) and plays audio if present.

### Key Architectural Decisions

- **Stateless n8n**: Conversation history serialized as plain text in `chatInput` (no Window Buffer Memory node). This avoids n8n state persistence issues.
- **Frontend history as JS array**: `conversationHistory[]` maintained in JS, never re-parsed from DOM. Only last 7 messages sent per request.
- **TTS as base64**: Avoids Supabase Storage latency; backend converts binary MP3 to data URL.
- **Cache exclusions**: Tool-using responses and vision responses are never cached (real-time data).
- **`load_dotenv()` before imports**: Required in `backend/src/main.py` before any env-dependent imports.

---

## File Map

| Goal | File |
|------|------|
| Chat endpoint logic | `backend/src/routes/chat.py` |
| Semantic cache check/store | `backend/src/services/cache.py` |
| n8n webhook call | `backend/src/services/n8n.py` |
| Frontend UI events & input modes | `frontend/app.js` |
| Frontend message rendering | `frontend/app.js` → `agregarMensaje()` |
| n8n workflow definition | `N8N/Agent AI-final.json` |
| Database schema (tables, indexes, RPC) | `supabase/schema.sql` |
| RAG population (web scraping) | `scripts/populate_rag.py` |
| FAQ cache seeding | `scripts/seed_cache.py` |
| Environment variable template | `scripts/.env-example` |

---

## Configuration

| Setting | File | Default | Effect |
|---------|------|---------|--------|
| Cache similarity threshold | `backend/src/services/cache.py` | `0.90` | Cosine similarity cutoff; lower = looser matches |
| RAG chunk size/overlap | `scripts/populate_rag.py` | `500 / 50` | RecursiveCharacterTextSplitter params |
| n8n LLM temperature | `N8N/Agent AI-final.json` | `0.2` | Keep low for financial accuracy |
| TTS voice | `backend/src/routes/chat.py:62` | `nova` | Options: alloy, echo, fable, onyx, shimmer, nova |

---

## Tech Stack

**Backend**: Python 3.11+, FastAPI, LangChain, OpenAI SDK, Supabase, httpx (async)

**Frontend**: Vanilla JS (ES6+), no npm dependencies — uses native Browser APIs: MediaRecorder, Canvas, FileReader, Fetch, Audio

**Infrastructure**: OpenAI API (gpt-4o-mini, text-embedding-3-small, whisper-1, tts-1), Supabase (PostgreSQL + pgvector extension), n8n Cloud

---

## Common Debugging

| Symptom | Likely Cause | Check |
|---------|--------------|-------|
| Cache always misses | Threshold too high or mismatched embeddings | `SIMILARITY_THRESHOLD` in `cache.py` |
| n8n webhook 404 | Wrong `N8N_WEBHOOK_URL` | Confirm URL in n8n workflow settings |
| CORS error in browser | Frontend served as `file://` | Use `npx serve frontend` |
| Backend 500 on startup | Missing env var | Verify all 4 vars in `backend/.env` |
| TTS audio silent | Bad MIME type or base64 | Verify `data:audio/mpeg;base64,...` in response |
| Image not sent correctly | Canvas `toDataURL()` failed | Check `app.js` ~line 115 |
