import os
os.environ.setdefault("USER_AGENT", "FinBot-RAG/1.0")

from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from supabase import create_client
from dotenv import load_dotenv
import time

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SECRET_KEY"))
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# URLs de Nequi con contenido relevante para FinBot
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
    print("🚀 Iniciando población de RAG...\n")

    # 1. Scraping con WebBaseLoader (bs4)
    print("📄 Paso 1: Scraping de las páginas...")
    loader = WebBaseLoader(URLS)
    loader.requests_kwargs = {
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Accept-Language": "es-CO,es;q=0.9",
        }
    }
    docs = loader.load()
    print(f"   ✅ {len(docs)} páginas cargadas: {sum(len(d.page_content) for d in docs)} chars\n")

    # 2. Chunking con overlap
    print("✂️  Paso 2: Chunking del texto...")
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_documents(docs)
    print(f"   ✅ Generados: {len(chunks)} chunks\n")

    # 3. Embeddings + Storage
    print("💾 Paso 3: Generando embeddings y guardando...\n")
    for i, chunk in enumerate(chunks):
        vector = embeddings.embed_query(chunk.page_content)
        supabase.table("rag_documents").insert({
            "content": chunk.page_content,
            "embedding": vector,
            "source_url": chunk.metadata.get("source", "")
        }).execute()
        print(f"   💾 Chunk {i+1}/{len(chunks)} guardado")
        time.sleep(0.1)  # Rate limit protection

    print(f"\n✅ RAG poblado exitosamente — {len(chunks)} chunks totales")

if __name__ == "__main__":
    populate()
