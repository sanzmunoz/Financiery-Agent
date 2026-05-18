# FinBot — Asistente Financiero con IA

Chatbot bilingüe (ES/EN) para fintech con RAG, caché semántico, voz, visión y tools externas.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Vanilla JS (HTML, CSS, JS) |
| Backend | Python, FastAPI, LangChain, OpenAI SDK |
| Agente IA | n8n cloud |
| Base de datos | Supabase (Postgres + pgvector) |

---

## Estructura del proyecto

```
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── backend/
│   ├── src/
│   │   ├── main.py                  # FastAPI app + CORS + rutas
│   │   ├── routes/
│   │   │   └── chat.py              # POST /api/chat  y  POST /api/transcribe
│   │   ├── services/
│   │   │   ├── cache.py             # Caché semántico (Supabase + embeddings)
│   │   │   └── n8n.py               # Cliente webhook n8n
│   │   └── config/
│   │       └── supabase.py          # Cliente Supabase
│   └── .env
│
├── scripts/
│   ├── populate_rag.py              # One-time: scrapea web e indexa en Supabase
│   └── seed_cache.py                # One-time: pre-pobla caché con FAQs
│
├── supabase/
│   └── schema.sql                   # Tablas rag_documents y semantic_cache
│
└── N8N/
    └── Agent AI.json                # Workflow exportado de n8n
```

---

## Setup completo — ejecutar en orden

### 1. Supabase — crear tablas

En el SQL Editor de tu proyecto Supabase, ejecuta el contenido de `supabase/schema.sql`.

Verifica que existan las tablas `rag_documents` y `semantic_cache` y la extensión `pgvector`.

---

### 2. Variables de entorno

Edita `backend/.env`:

```bash
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=eyJhbGc...
N8N_WEBHOOK_URL=https://tu-instancia.n8n.cloud/webhook/finbot
```

Edita `scripts/.env` con los mismos valores (sin `N8N_WEBHOOK_URL`).

---

### 3. Entorno virtual e instalación de dependencias

```bash
python -m venv .venv
source .venv/bin/activate      # Linux/Mac
# .venv\Scripts\activate       # Windows

pip install -r backend/requirements.txt
```

---

### 4. Poblar RAG (one-time)

Scrapea páginas de Nequi y Bancolombia y guarda los chunks con embeddings en Supabase.

```bash
python scripts/populate_rag.py
```

Verifica: `SELECT COUNT(*) FROM rag_documents;` debe retornar > 0.

---

### 5. Poblar caché semántico (one-time)

Inserta 7 preguntas frecuentes de FinBot con sus embeddings en `semantic_cache`.

```bash
python scripts/seed_cache.py
```

Verifica: `SELECT query_text FROM semantic_cache;` debe mostrar las entradas.

---

### 6. Importar workflow en n8n

Importa `N8N/Agent AI.json` en tu instancia de n8n cloud. Configura las credenciales de OpenAI y Supabase en los nodos correspondientes y activa el workflow.

---

### 7. Iniciar el backend

```bash
cd backend
fastapi dev src/main.py
```

El servidor queda en `http://localhost:8000`.

---

### 8. Abrir el frontend

Abre `frontend/index.html` directamente en el navegador, o sirve la carpeta con cualquier servidor estático:

```bash
npx serve frontend
```

---

## Flujo de llamadas — mensaje de texto

```
[Navegador] frontend/app.js
│
├─ Usuario escribe y presiona Enviar
│   └─ manejarEnvioMensaje()
│       ├─ imagenParaEnviar = imagenActual   ← captura ANTES del reset
│       ├─ agregarMensaje({ rol:'user' })    ← renderiza burbuja en UI
│       └─ fetch POST /api/chat
│           body: { message, messages: construirHistorial()[-7], image, mode }
│                               │
[Backend] backend/src/routes/chat.py  →  POST /chat
│   ├─ [Sin imagen] → check_semantic_cache(message)
│   │       ├─ aembed_query(message) → vector
│   │       └─ supabase.rpc('match_cache', threshold=0.90)
│   │           ├─ HIT  → return { response, from_cache: true } ──► frontend
│   │           └─ MISS → continúa ↓
│   │
│   ├─ call_n8n_agent(message, messages, image, mode)
│   │       └─ httpx POST N8N_WEBHOOK_URL (timeout 60s)
│   │           body: { message, messages[], image, mode }
│   │                           │
│   │           [n8n Workflow]  │
│   │           ├─ Parse Input: detecta idioma, arma chatInput con historial
│   │           ├─ IF image → rama Vision (gpt-4o-mini via HTTP Request)
│   │           └─ ELSE → AI Agent (gpt-4o-mini) + tools:
│   │               ├─ Rag FitBox        → Supabase Vector Store (RAG)
│   │               ├─ calculate_interest → Code Tool
│   │               ├─ get_usd_rate      → HTTP (open.er-api.com)
│   │               └─ currency_convert  → HTTP (frankfurter.dev)
│   │           └─ Respond to Webhook → { response, tool_used }
│   │
│   ├─ [mode === 'audio'] → OpenAI TTS → base64 → audio_url
│   ├─ [Sin imagen, sin tool] → store_in_cache(message, response)
│   └─ return { response, from_cache, tool_used, audio_url, latency }
│                               │
[Navegador] frontend/app.js  ◄─┘
│   ├─ conversationHistory.push(user)
│   ├─ conversationHistory.push(assistant)
│   ├─ agregarMensaje() → createElement
│   │   └─ badges: ⚡ Caché / 🔧 tool / ⏱️ latency
│   └─ [si audio_url] → new Audio(url).play()
```

---

## Flujo de llamadas — voz (STT)

```
[Navegador]
├─ Modo "Voz" → iniciarGrabacion()
│   └─ MediaRecorder → audioChunks[]
├─ Detener → transcribirAudio(blob)
│   └─ fetch POST /api/transcribe (FormData)
│                       │
[Backend] POST /transcribe
│   ├─ Whisper API (whisper-1, auto-detect ES/EN)
│   └─ return { text: "transcripción..." }
│                       │
[Navegador] ◄───────────┘
│   └─ inputMensaje.value = text → usuario puede editar y enviar → flujo normal
```

---

## Flujo de llamadas — imagen (Vision)

```
[Navegador]
├─ Modo "Imagen+Texto" → FileReader → canvas resize (max 800px, JPEG 70%)
├─ manejarEnvioMensaje()
│   ├─ imagenParaEnviar = imagenActual   ← captura ANTES del reset
│   └─ fetch POST /api/chat { image: base64 }
│                       │
[Backend] POST /chat
│   ├─ image presente → OMITE check_semantic_cache
│   ├─ call_n8n_agent con image en base64
│   │       └─ n8n: IF image → Code JS → OpenAI Vision (gpt-4o-mini)
│   │           → Parse JSON response → Format → Respond
│   └─ OMITE store_in_cache
```

---

## APIs

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/chat` | Enviar mensaje al agente |
| POST | `/api/transcribe` | Transcribir audio con Whisper |

### Body `/api/chat`
```json
{
  "message": "¿Cuánto está el dólar hoy?",
  "messages": [{ "role": "user", "content": "..." }],
  "image": null,
  "mode": "text"
}
```

### Response `/api/chat`
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

## Decisiones técnicas

- **TTS en backend, no en n8n**: OpenAI TTS devuelve binario. En lugar de subir a Supabase Storage desde n8n, el backend convierte el audio a base64 y lo devuelve como `data:audio/mpeg;base64,...` directamente en la respuesta JSON. Evita el paso de storage y funciona sin configuración adicional.

- **Historial inyectado como texto**: El historial de los últimos 7 mensajes se serializa en el `chatInput` del Parse Input de n8n en lugar de usar un nodo Window Buffer Memory. Esto permite control total sobre el formato y evita dependencias de estado en n8n.

- **No se cachean respuestas de tools**: Si `tool_used` tiene valor, la respuesta no se guarda en caché — los resultados de tools como tasas de cambio o precios de cripto son datos en tiempo real que no deben cachearse.

- **`crypto_price` desconectado intencionalmente**: El tool existe en el workflow pero no está conectado al AI Agent.