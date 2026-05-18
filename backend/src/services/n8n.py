import os
import httpx

N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL")

async def call_n8n_agent(message: str, messages: list, image: str, mode: str):
    # 60s timeout covers the worst case: agent reasoning + optional TTS generation in n8n
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(N8N_WEBHOOK_URL, json={
            "message": message,
            "messages": messages,
            "image": image,
            "mode": mode
        })
        response.raise_for_status()
        return response.json()
