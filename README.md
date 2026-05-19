# Bilingual Financial AI Assistant

Bilingual chatbot (ES/EN) for a fintech with RAG, semantic cache, voice pipeline, vision, and real-time financial tools.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (HTML, CSS, JS) — no framework |
| Backend | Python, FastAPI, LangChain, OpenAI SDK |
| AI Agent | n8n Cloud |
| Database | Supabase (PostgreSQL + pgvector) |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## Project structure

```
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── assets/
│       └── agent.jpeg       # Chat background image
│
├── backend/
│   ├── src/
│   │   ├── main.py                 # FastAPI app — CORS + routes
│   │   ├── routes/
│   │   │   └── chat.py             # POST /api/chat  and  POST /api/transcribe
│   │   ├── services/
│   │   │   ├── cache.py            # Semantic cache (Supabase + embeddings)
│   │   │   └── n8n.py              # n8n webhook client
│   │   └── config/
│   │       └── supabase.py         # Supabase client
│   └── .env-example
│
├── scripts/
│   ├── populate_rag.py             # One-time: scrape web and index into Supabase
│   └── seed_cache.py               # One-time: pre-populate cache with FAQs
│
├── supabase/
│   └── schema.sql                  # Tables, indexes, and RPC functions
│
├── requirements.txt                # Python dependencies (root level)
│
└── N8N/
    └── Agent AI-final.json         # Exported n8n workflow
```

---

## Environment variables

Create `backend/.env` with:

```bash
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=eyJhbGc...          # use service_role key, not anon
N8N_WEBHOOK_URL=https://tu-instancia.n8n.cloud/webhook/financial-agent
ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

Create `scripts/.env` with the same values except `N8N_WEBHOOK_URL` and `ALLOWED_ORIGINS`.

---

## Local setup — run in order

### 1. Supabase — create tables

In the Supabase SQL Editor, run the full contents of `supabase/schema.sql`.

Use the **Run** button — do **not** use "Run and enable RLS", as the schema explicitly disables RLS for these tables.

Verify:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
SELECT proname FROM pg_proc WHERE proname LIKE 'match_%';
```

---

### 2. Python environment and dependencies

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
```

---

### 3. Populate RAG index (one-time)

Scrapes 10 pages from Nequi and Bancolombia and stores chunks with embeddings in Supabase.

```bash
python scripts/populate_rag.py
```

Source URLs indexed by the RAG pipeline:

| Source | URL |
|--------|-----|
| Nequi | https://www.nequi.com.co/personas/ayuda/tips-de-seguridad |
| Nequi | https://www.nequi.com.co/blog/que-son-los-dolares-digitales-y-como-funcionan-guia-facil-para-entenderlos |
| Nequi | https://www.nequi.com.co/blog/que-tu-huella-digital-no-te-haga-vulnerable-tips-para-protegernos-en-linea |
| Bancolombia | https://www.bancolombia.com/educacion-financiera/seguridad-de-la-informacion/proteccion-informacion-en-internet |
| Bancolombia | https://www.bancolombia.com/educacion-financiera/seguridad-de-la-informacion/smishing |
| Bancolombia | https://www.bancolombia.com/educacion-financiera/seguridad-de-la-informacion/phishing |
| Bancolombia | https://www.bancolombia.com/centro-de-ayuda/preguntas-frecuentes/abrir-cuenta-ahorros-bancolombia-celular |
| Bancolombia | https://www.bancolombia.com/educacion-financiera/finanzas-personales/que-son-gastos-hormiga |
| Bancolombia | https://www.bancolombia.com/educacion-financiera/finanzas-personales/como-administrar-dinero |
| Bancolombia | https://www.bancolombia.com/educacion-financiera/finanzas-personales/todo-sobre-ahorro |

Verify: `SELECT COUNT(*) FROM rag_documents;` should return > 0.

---

### 4. Seed semantic cache (one-time)

Inserts 7 pre-defined Financial Agent FAQs with embeddings into `semantic_cache`.

```bash
python scripts/seed_cache.py
```

Verify: `SELECT query_text FROM semantic_cache;` should show the FAQ entries.

---

### 5. Import n8n workflow

Import `N8N/Agent AI-final.json` into your n8n Cloud instance. Configure OpenAI and Supabase credentials on the corresponding nodes and activate the workflow.

---

### 6. Start the backend

```bash
cd backend
fastapi dev src/main.py
```

Server runs at `http://localhost:8000`. Health check: `GET /health`.

---

### 7. Open the frontend

```bash
npx serve frontend
```

Or open `frontend/index.html` directly (note: some browser APIs like MediaRecorder require HTTPS or localhost).

---

## Production deployment

### Backend — Render

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build command | `pip install -r ../requirements.txt` |
| Start command | `fastapi run src/main.py --host 0.0.0.0 --port $PORT` |

Add all five environment variables in Render's **Environment** panel. After the frontend is deployed, update `ALLOWED_ORIGINS` with the Vercel URL and redeploy.

### Frontend — Vercel

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Framework | Other |

The `BACKEND_URL` in `app.js` switches automatically between localhost (development) and the Render URL (production) based on `window.location.hostname`.

---

## Request flow — text message

```
[Browser] frontend/app.js
│
├─ User types and submits
│   └─ manejarEnvioMensaje()
│       ├─ imagenParaEnviar = imagenActual   ← captured before DOM reset
│       ├─ agregarMensaje({ rol:'user' })    ← render bubble
│       └─ fetch POST /api/chat
│           body: { message, messages: construirHistorial()[-7], image, mode }
│                               │
[Backend] backend/src/routes/chat.py  →  POST /chat
│   ├─ [No image] → check_semantic_cache(message)
│   │       ├─ embed message → pgvector cosine similarity (threshold 0.90)
│   │       ├─ HIT  → return { response, from_cache: true } ──► frontend
│   │       └─ MISS → continue ↓
│   │
│   ├─ call_n8n_agent(message, messages, image, mode)
│   │       └─ POST N8N_WEBHOOK_URL (60s timeout)
│   │           [n8n Workflow]
│   │           ├─ Parse Input: detect language, build chatInput with history
│   │           ├─ IF image → Vision branch (gpt-4o-mini via HTTP Request)
│   │           └─ ELSE → AI Agent (gpt-4o-mini) + tools:
│   │               ├─ Rag FitBox        → Supabase Vector Store (RAG)
│   │               ├─ calculate_interest → Code Tool (compound interest)
│   │               ├─ get_usd_rate      → open.er-api.com
│   │               └─ currency_convert  → frankfurter.dev
│   │           └─ Respond to Webhook → { response, tool_used }
│   │
│   ├─ [mode === 'audio'] → OpenAI TTS → base64 → audio_url
│   ├─ [No image, no tool] → store_in_cache(message, response)
│   └─ return { response, from_cache, tool_used, audio_url, latency }
│                               │
[Browser] frontend/app.js  ◄───┘
│   ├─ conversationHistory.push(user + assistant)
│   ├─ agregarMensaje() → createElement
│   │   └─ badges: Cache / tool_name / latency ms
│   └─ [if audio_url] → new Audio(url).play()
```

---

## Request flow — voice (STT)

```
[Browser]
├─ Mode "Voz" → iniciarGrabacion()
│   └─ MediaRecorder → audioChunks[]
├─ Stop → transcribirAudio(blob)
│   └─ fetch POST /api/transcribe (FormData)
│                       │
[Backend] POST /transcribe
│   ├─ Whisper (whisper-1, no language param → auto-detects ES/EN)
│   └─ return { text: "transcription..." }
│                       │
[Browser] ◄─────────────┘
│   └─ inputMensaje.value = text → user edits and submits → normal flow
```

---

## Request flow — image (Vision)

```
[Browser]
├─ Mode "Imagen+Texto" → FileReader → canvas resize (max 800px, JPEG 70%)
├─ manejarEnvioMensaje()
│   ├─ imagenParaEnviar = imagenActual   ← captured before DOM reset
│   └─ fetch POST /api/chat { image: base64 }
│                       │
[Backend] POST /chat
│   ├─ image present → skip check_semantic_cache
│   ├─ call_n8n_agent with image in base64
│   │       └─ n8n: IF image → Code JS → OpenAI Vision (gpt-4o-mini)
│   │           → Parse JSON response → Format → Respond
│   └─ skip store_in_cache
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/chat` | Send message to the agent |
| POST | `/api/transcribe` | Transcribe audio with Whisper |

### POST `/api/chat` — request body
```json
{
  "message": "¿Cuánto está el dólar hoy?",
  "messages": [{ "role": "user", "content": "..." }],
  "image": null,
  "mode": "text"
}
```

### POST `/api/chat` — response
```json
{
  "response": "El dólar está a $4,250 COP hoy.",
  "from_cache": false,
  "tool_used": "get_usd_rate",
  "audio_url": null,
  "latency": 1340
}
```

---

## Technical decisions

- **TTS as base64, not file storage**: OpenAI TTS returns binary audio. The backend converts it to `data:audio/mpeg;base64,...` and returns it directly in the JSON response, avoiding Supabase Storage latency and extra configuration.

- **History injected as plain text**: The last 7 messages (3 when an image is present) are serialized in the `chatInput` field of the n8n Parse Input node instead of using a Window Buffer Memory node. This gives full control over formatting and avoids n8n state persistence issues.

- **Tool responses are never cached**: If `tool_used` is set, the response is not stored in the semantic cache — tools like `get_usd_rate` and `currency_convert` return real-time data that must not be served stale.

- **`crypto_price` intentionally disconnected**: The CoinGecko tool node exists in the n8n workflow but is not connected to the AI Agent. `currency_convert` (frankfurter.dev) handles international currency conversion as the active third external API.

- **CORS restricted via env var**: `ALLOWED_ORIGINS` is read from the environment so the allowed origin list can differ between local development and production without code changes.

- **Dynamic backend URL in frontend**: `app.js` detects `window.location.hostname` to switch between `http://localhost:8000` (development) and the Render production URL automatically.

- **Custom coin cursor**: A JavaScript-driven `$` character follows the mouse outside the chat, input, and header areas. The system cursor is hidden only in those zones; interactive elements inside the chat restore the default cursor automatically.

- **Chat background image**: The `.chat-container` uses a CSS layered background — the image (`assets/agent_finbot.jpeg`) sits below a semi-transparent green overlay so message bubbles remain readable regardless of image contrast.
