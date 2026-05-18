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

    # 1. Check semantic cache — skip if an image is attached
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

    # 2. Forward request to the n8n agent workflow
    n8n_response = await call_n8n_agent(
        message=req.message,
        messages=[m.model_dump() for m in req.messages],
        image=req.image,
        mode=req.mode
    )

    response_text = n8n_response.get("response")
    tool_used     = n8n_response.get("tool_used")

    # 3. Cache the response only when no tool was used (tool results contain real-time data)
    if not req.image and response_text and not tool_used:
        await store_in_cache(req.message, response_text)

    # 4. Generate TTS audio if response mode is "audio"; return as base64 to avoid storage overhead
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
            print(f"TTS error: {e}")

    return {
        "response":   response_text,
        "from_cache": False,
        "tool_used":  tool_used,
        "audio_url":  audio_url,
        "latency":    int((time.time() - start) * 1000)
    }

@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    # No language param — Whisper auto-detects ES/EN (supports bilingual pipeline)
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
