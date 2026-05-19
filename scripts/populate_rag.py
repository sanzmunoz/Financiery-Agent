import os
os.environ.setdefault("USER_AGENT", "Financial-Agent-RAG/1.0")

from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from supabase import create_client
from dotenv import load_dotenv
import time

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SECRET_KEY"))
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Source URLs: Nequi and Bancolombia pages covering security, savings, and personal finance
URLS = [
    "https://www.nequi.com.co/personas/ayuda/tips-de-seguridad",
    "https://www.nequi.com.co/blog/que-son-los-dolares-digitales-y-como-funcionan-guia-facil-para-entenderlos",
    "https://www.bancolombia.com/educacion-financiera/seguridad-de-la-informacion/proteccion-informacion-en-internet",
    "https://www.bancolombia.com/educacion-financiera/seguridad-de-la-informacion/smishing",
    "https://www.bancolombia.com/educacion-financiera/seguridad-de-la-informacion/phishing",
    "https://www.bancolombia.com/centro-de-ayuda/preguntas-frecuentes/abrir-cuenta-ahorros-bancolombia-celular",
    "https://www.nequi.com.co/blog/que-tu-huella-digital-no-te-haga-vulnerable-tips-para-protegernos-en-linea",
    "https://www.bancolombia.com/educacion-financiera/finanzas-personales/que-son-gastos-hormiga",
    "https://www.bancolombia.com/educacion-financiera/finanzas-personales/como-administrar-dinero",
    "https://www.bancolombia.com/educacion-financiera/finanzas-personales/todo-sobre-ahorro"
]

def populate():
    print("Starting RAG population...\n")

    # Step 1: Scrape pages with WebBaseLoader
    print("Step 1: Scraping pages...")
    loader = WebBaseLoader(URLS)
    loader.requests_kwargs = {
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Accept-Language": "es-CO,es;q=0.9",
        }
    }
    docs = loader.load()
    print(f"   {len(docs)} pages loaded — {sum(len(d.page_content) for d in docs)} chars\n")

    # Step 2: Chunk with overlap
    print("Step 2: Chunking...")
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_documents(docs)
    print(f"   {len(chunks)} chunks generated\n")

    # Step 3: Embed and store in Supabase pgvector
    print("Step 3: Generating embeddings and storing...\n")
    for i, chunk in enumerate(chunks):
        vector = embeddings.embed_query(chunk.page_content)
        supabase.table("rag_documents").insert({
            "content": chunk.page_content,
            "embedding": vector,
            "source_url": chunk.metadata.get("source", "")
        }).execute()
        print(f"   Chunk {i+1}/{len(chunks)} stored")
        time.sleep(0.1)  # Avoid hitting embedding API rate limits

    print(f"\nRAG populated successfully — {len(chunks)} chunks total")

if __name__ == "__main__":
    populate()
