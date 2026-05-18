from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from supabase import create_client
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os, time

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SECRET_KEY"))
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Preguntas frecuentes de FinBot con sus respuestas predeterminadas
FAQ = [
    {
        "query": "¿Cuál es el horario de atención de FinBot?",
        "response": "FinBot Financial Services atiende de lunes a viernes de 8:00 AM a 6:00 PM (hora Colombia) y sábados de 9:00 AM a 1:00 PM. Nuestro asistente virtual está disponible las 24 horas del día, los 7 días de la semana."
    },
    {
        "query": "¿Cómo recupero mi contraseña?",
        "response": "Para recuperar su contraseña, siga estos pasos: 1) Ingrese a la app FinBot y seleccione '¿Olvidó su contraseña?'. 2) Ingrese su número de celular registrado. 3) Recibirá un código OTP por SMS. 4) Ingrese el código y establezca su nueva contraseña. Si persiste el problema, contáctenos al *611 desde su celular."
    },
    {
        "query": "¿Cuánto demora una transferencia entre cuentas FinBot?",
        "response": "Las transferencias entre cuentas FinBot son inmediatas, disponibles las 24 horas. Las transferencias a otros bancos a través de PSE o ACH se procesan en máximo 2 horas hábiles. Las transferencias internacionales pueden tardar entre 1 y 3 días hábiles dependiendo del banco destino."
    },
    {
        "query": "¿Cuál es el límite de transferencia diario en FinBot?",
        "response": "Los límites de transferencia en FinBot son: Cuenta Básica: $3,000,000 COP diarios. Cuenta Plus: $10,000,000 COP diarios. Cuenta Premium: $30,000,000 COP diarios. Para aumentar su límite, puede solicitar un upgrade de cuenta desde la app o comunicarse con nuestro equipo de soporte."
    },
    {
        "query": "¿Cómo abro una cuenta en FinBot?",
        "response": "Abrir una cuenta FinBot es 100% digital y gratuito: 1) Descargue la app FinBot desde App Store o Google Play. 2) Seleccione 'Crear cuenta'. 3) Ingrese su número de celular y verifíquelo con el código OTP. 4) Tome una foto de su cédula de ciudadanía (ambas caras). 5) Complete una selfie para validación biométrica. El proceso toma menos de 5 minutos."
    },
    {
        "query": "¿FinBot tiene costos o comisiones?",
        "response": "FinBot ofrece una cuenta de ahorros sin cuota de manejo. Las transferencias entre cuentas FinBot son gratuitas e ilimitadas. Las transferencias a otros bancos tienen un costo de $1,200 COP por transacción. Los retiros en cajeros de la red Servibanca tienen un costo de $2,500 COP. Consulte nuestra app para conocer todos los beneficios según su tipo de cuenta."
    },
    {
        "query": "¿Cómo bloqueo mi tarjeta FinBot si la perdí?",
        "response": "Si perdió o le robaron su tarjeta FinBot, puede bloquearla inmediatamente de estas formas: 1) Desde la app: vaya a 'Mi tarjeta' → 'Bloquear tarjeta'. 2) Llamando a nuestra línea de emergencias: *611 (disponible 24/7). 3) Desde nuestra página web en la sección 'Mi cuenta'. El bloqueo es instantáneo y puede solicitar una tarjeta de reposición sin costo adicional."
    },
]

def seed():
    print(f"🌱 Poblando caché semántico con {len(FAQ)} preguntas frecuentes...\n")

    for i, item in enumerate(FAQ):
        vector = embeddings.embed_query(item["query"])

        supabase.table("semantic_cache").insert({
            "query_text": item["query"],
            "query_embedding": vector,
            "response": item["response"]
        }).execute()

        print(f"   ✅ {i+1}/{len(FAQ)}: {item['query'][:60]}...")
        time.sleep(0.1)

    print(f"\n✅ Caché poblado exitosamente con {len(FAQ)} entradas")

    docs = [
        Document(page_content=item["response"], metadata={"source": "faq"})
        for item in FAQ
    ]

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_documents(docs)

    print(f"💾 Paso 3: Generando embeddings y guardando {len(chunks)} chunks en RAG...\n")
    for i, chunk in enumerate(chunks):
        vector = embeddings.embed_query(chunk.page_content)
        supabase.table("rag_documents").insert({
            "content": chunk.page_content,
            "embedding": vector,
            "metadata": chunk.metadata,
            "source_url": chunk.metadata.get("source", "faq")
        }).execute()
        print(f"   💾 Chunk {i+1}/{len(chunks)} guardado")
        time.sleep(0.1)

if __name__ == "__main__":
    seed()
