import os
from langchain_openai import OpenAIEmbeddings
from src.config.supabase import supabase

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

SIMILARITY_THRESHOLD = 0.90

async def check_semantic_cache(query: str):
    vector = await embeddings.aembed_query(query)
    vector_str = f"[{','.join(map(str, vector))}]"

    result = supabase.rpc("match_cache", {
        "query_embedding_input": vector_str,
        "match_threshold": SIMILARITY_THRESHOLD,
        "match_count": 1
    }).execute()

    if result.data:
        return result.data[0]
    return None

async def store_in_cache(query: str, response: str):
    vector = await embeddings.aembed_query(query)
    vector_str = f"[{','.join(map(str, vector))}]"

    supabase.table("semantic_cache").insert({
        "query_text": query,
        "query_embedding": vector_str,
        "response": response
    }).execute()
