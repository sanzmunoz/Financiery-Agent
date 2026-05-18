import time
import os
import base64
import tempfile
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
import openai
from src.services.cache import check_semantic_cache, store_in_cache
from src.services.n8n import call_n8n_agent

router = APIRouter()
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    messages: List[Message] = []
    image: Optional[str] = None
    mode: str = "text"

@router.post("/chat")
async def chat(req: ChatRequest):
    start = time.time()

    # 1. Check caché (solo si no hay imagen)
    if not req.image:
        cached = await check_semantic_cache(req.message)
        if cached:
            return {
                "response":   cached["response"],
                "from_cache": True,
                "tool_used":  None,
                "audio_url":  None,
                "latency":    int((time.time() - start) * 1000)
            }

    # 2. Llamar a n8n
    n8n_response = await call_n8n_agent(
        message=req.message,
        messages=[m.model_dump() for m in req.messages],
        image=req.image,
        mode=req.mode
    )

    response_text = n8n_response.get("response")
    tool_used     = n8n_response.get("tool_used")

    # 3. Guardar en caché (no cachear si usó tool - parámetros únicos por pregunta)
    if not req.image and response_text and not tool_used:
        await store_in_cache(req.message, response_text)

    # 4. Generar audio TTS si mode === "audio" (base64, no requiere storage)
    audio_url = None
    if req.mode == "audio" and response_text:
        try:
            audio_response = client.audio.speech.create(
                model="tts-1",
                voice="nova",
                input=response_text
            )
            audio_base64 = base64.b64encode(audio_response.content).decode("utf-8")
            audio_url = f"data:audio/mpeg;base64,{audio_base64}"
        except Exception as e:
            print(f"❌ Error TTS: {e}")

    return {
        "response":   response_text,
        "from_cache": False,
        "tool_used":  tool_used,
        "audio_url":  audio_url,
        "latency":    int((time.time() - start) * 1000)
    }

@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    # Sin language para auto-detección bilingüe ES/EN (Reto 01 + Reto 03)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    with open(tmp_path, "rb") as f:
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=f
        )

    os.unlink(tmp_path)
    return {"text": transcription.text}