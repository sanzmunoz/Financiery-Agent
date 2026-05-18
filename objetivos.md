1. Agente bilingüe con personalidad definida. El reto:
Construye un agente conversacional para una fintech llamada FinBot que opera en Colombia y Estados
Unidos. El agente detecta el idioma del mensaje entrante y responde siempre en ese idioma, sin que el
coder configure nada.
Requisitos:
• System prompt con: nombre del agente, empresa, tono formal financiero, restricción de temas (solo
finanzas personales, productos FinBot y soporte) y regla de detección de idioma.
• Detección automática: el agente lee el idioma del mensaje y responde en ese idioma sin instrucción
explícita del usuario.
• Si el usuario cambia de idioma a mitad de la conversación, el agente cambia en el siguiente
mensaje.
• Memoria de los últimos 7 mensajes: nombres y contexto se recuerdan a lo largo de la sesión.
• Si el usuario pregunta algo fuera del dominio financiero, el agente declina coherentemente en el
idioma activo.
Verifica:
- Español -> respuesta en español con tono formal financiero.
- Inglés -> respuesta en inglés con el mismo tono.
- Cambia de idioma en mensaje 4 -> el agente cambia también.
- Mensaje 7 hace referencia al mensaje 1 -> el agente lo recuerda.
- Pregunta fuera de tema -> el agente declina en el idioma activo.

- Incluye en el system prompt: 'Always detect the language of each user message and respond in that same
language'.
- Edge case interesante: ¿qué pasa si el usuario mezcla español e inglés en el mismo mensaje?

2. 3 tools: 2 propias + 1 API externa real.El reto:
El agente FinBot necesita capacidades reales. Implementa tres tools y conéctalas al agente. La tercera
debe consumir una API externa real — elige cuál tiene sentido para un asistente financiero.
Requisitos:
• Tool 1 — calculate_interest(principal, rate, years): calcula interés compuesto. Lógica propia.
Retorna monto final e intereses generados.
• Tool 2 — get_usd_rate(): retorna tipo de cambio USD/COP. Puede ser hardcodeado documentado
o consumir una API de divisas gratuita.
• Tool 3 — API externa real de tu elección: ejemplos útiles para finanzas: precio de criptomonedas
(CoinGecko — gratuita sin key), noticias financieras (NewsAPI), datos macroeconómicos. Documenta
cuál elegiste y por qué.
• El agente activa la tool correcta según el contexto, sin que el usuario la mencione por nombre.
• Las 3 tools tienen nombre, descripción y parámetros claros en el código.
Verifica:
- "Si invierto 10M al 8% anual 5 años, ¿cuánto tengo?" -> activa calculate_interest().
- "¿A cuánto está el dólar hoy?" -> activa get_usd_rate().
- Pregunta relacionada con tu API externa -> activa tool 3.
- Pregunta general sin datos -> responde directamente sin activar tools.
- El agente integra el resultado de la tool en una respuesta natural, no solo imprime el número.

-CoinGecko: GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs;_currencies=usd — sin API key.

3. Pipeline de voz: entrada y salida de audio. El reto:
Construye un pipeline donde el audio del usuario se transcribe con Whisper, ese texto va al agente
FinBot, y la respuesta vuelve como audio sintetizado. El flujo completo: audio in -> texto -> agente ->
texto -> audio out.
Requisitos:
• Entrada de voz: acepta archivo de audio (.mp3, .wav u .ogg) o grabación desde el navegador.
Whisper transcribe a texto. El texto transcrito es visible antes de enviarse al agente.
• Procesamiento: el texto transcrito entra al agente exactamente igual que un mensaje escrito.
• Salida de voz: la respuesta del agente se sintetiza (ElevenLabs, OpenAI TTS u otro) y se
reproduce en la interfaz.
• El coder puede elegir entre enviar texto escrito o audio — ambos modos llegan al mismo agente.
Verifica:
- Sube o graba un audio -> el texto transcrito aparece en pantalla.
- El agente recibe ese texto y responde coherentemente.
- La respuesta se reproduce como audio.
- El pipeline completo funciona sin intervención manual.
- Enviar texto escrito también funciona (los dos modos coexisten).

- Whisper API: /v1/audio/transcriptions, acepta archivos hasta 25 MB.
- MediaRecorder API en JavaScript graba desde el micrófono y genera un Blob de audio directamente.

4. RAG sobre una web real. El reto:
El agente FinBot debe responder preguntas basadas en el contenido de una web real — por ejemplo
FAQ, términos y condiciones o página de productos de un banco o fintech. Construye un pipeline RAG
que indexe esa información y la use como contexto cuando el usuario haga preguntas relevantes.
Requisitos:
• Elegir una URL real con contenido relevante (FAQ de Nequi, productos de Bancolombia, términos
de Rappi Pay, etc.). Documentarla en el código.
• Hacer fetch o scraping del contenido y extraer el texto útil eliminando navegación y boilerplate.
• Aplicar chunking con overlap (mínimo 3 chunks, overlap de al menos 50 caracteres entre ellos).
• Generar embeddings y almacenar en base vectorial (Chroma, FAISS, Supabase, Pinecone o
cualquier otra).
• Cuando la pregunta coincida semánticamente con el contenido indexado, el agente usa los chunks
como contexto.
• Cuando la pregunta no tenga relación, el agente responde con conocimiento general sin forzar el
RAG.
Verifica:
- La ingestión corre sin errores y genera al menos 3 chunks almacenados.
- Pregunta directamente sobre contenido de la URL -> la respuesta refleja información de esa web.
- Pregunta genérica que no está en la URL -> el agente responde sin mencionar la web.
- El agente integra el contexto RAG con su personalidad FinBot (tono formal, idioma detectado).

- LangChain: WebBaseLoader para fetch + RecursiveCharacterTextSplitter para chunking.
- FAISS es local y no requiere cuenta ni API key — ideal para no perder tiempo en configuración.

5. Vision: Analisis de imagenes en el agente. El reto: 
El reto:
El agente FinBot ahora puede recibir imágenes además de texto y audio. Los clientes pueden adjuntar
capturas de pantalla de extractos bancarios, errores en apps de pago o transferencias fallidas, y el
agente analiza la imagen y responde en consecuencia.
Requisitos:
• La UI tiene un botón o zona de carga para adjuntar una imagen (.jpg, .png o .webp) junto con un
mensaje de texto.
• El backend convierte la imagen a base64 y la incluye en el mensaje enviado al modelo de visión
(GPT-4o, Claude 3.5 o equivalente).
• El agente analiza el contenido de la imagen y lo integra con el texto del mensaje para generar una
respuesta contextual.
• Si el usuario envía solo texto (sin imagen), el agente funciona exactamente igual que antes — la
visión es un modo adicional, no reemplaza el texto.
• El agente debe poder responder al menos estos tres casos con imagen: extracto bancario, captura
de error en app de pagos, y comprobante de transferencia.
Verifica:
- Adjunta una captura de un extracto bancario + escribe "¿cuánto gasté en restaurantes?" -> el agente
analiza la imagen y responde.
- Adjunta una captura de pantalla de un error de pago + escribe "¿qué significa este error?" -> el agente
describe el error y sugiere solución.
- Adjunta un comprobante de transferencia + escribe "¿se realizó correctamente?" -> el agente lee los
datos de la imagen y confirma.
- Envía un mensaje sin imagen -> el agente funciona normal sin intentar procesar visión.
- El agente mantiene el tono formal de FinBot y responde en el idioma activo al analizar imágenes.

- Claude: en el array content usa {type: 'image', source: {type: 'base64', media_type: 'image/jpeg', data: '...'}}
- Para prueba rápida: captura pantalla de cualquier app de pagos o descarga un extracto bancario de ejemplo de
Google Images.

6. Caché semantico para preguntas frecuentes. El reto:
En producción, el agente FinBot recibe cientos de preguntas muy similares todos los días: "¿cuál es el
horario de atención?", "¿cómo recupero mi contraseña?", "¿cuánto demora una transferencia?". Cada
una llama a la API y genera costo. Implementa un caché semántico que detecte preguntas similares y
devuelva la respuesta almacenada sin llamar al LLM.

Cómo funciona el caché semántico:
Llega una pregunta nueva -> Generar embedding de la pregunta -> Comparar con embeddings en caché (similitud coseno) -> Similitud > umbral: devolver respuesta cacheada Similitud < umbral: llamar al LLM + guardar en caché

Requisitos:
• Crear un caché en memoria (dict o lista) o persistente (archivo JSON o base de datos ligera) que
almacene pares {embedding: vector, pregunta: texto, respuesta: texto}.
• Antes de cada llamada al LLM: generar el embedding de la pregunta entrante y buscar en el caché
si existe una pregunta con similitud coseno por encima de un umbral configurable (sugerido: 0.90).
• Si hay hit en caché: devolver la respuesta almacenada directamente, sin llamar al LLM. Mostrar en
la UI un indicador visual de que la respuesta vino del caché (ej: badge 'Caché').
• Si no hay hit: llamar al LLM normalmente y guardar la nueva pregunta + respuesta en el caché.
• Pre-poblar el caché con al menos 5 preguntas frecuentes de FinBot con sus respuestas (horarios,
recuperación de contraseña, tiempos de transferencia, etc.).
• El umbral de similitud debe ser configurable — ponerlo como constante en el código, no
hardcodeado en la lógica.

Verifica:
• Pregunta exacta del caché -> respuesta inmediata con indicador 'Caché' en la UI.
• Pregunta muy similar (misma intención, palabras distintas) -> también hit en caché.
• Pregunta completamente diferente -> va al LLM, respuesta sin indicador de caché.
• La respuesta del caché es idéntica a la respuesta almacenada originalmente.
• Bajar el umbral a 0.70 -> más preguntas dan hit. Subirlo a 0.98 -> solo coincidencias casi exactas.
• numpy.dot(a, b) / (numpy.linalg.norm(a) * numpy.linalg.norm(b)) — similitud coseno en dos líneas.
• GPTCache y LangChain tienen implementaciones de caché semántico listas si quieres comparar con tu solución
propia.
• El indicador visual 'Caché' en la UI es importante: el coder debe saber cuándo el sistema está ahorrando
llamadas a la API.

7. App web con indicador visual de tools y caché. El reto:
Construye la interfaz web que une todo lo anterior. El stack es completamente libre. Lo importante es
que la UI refleje el comportamiento interno del agente de forma visible.
Requisitos:
• Chat con historial, campo de texto, botón de envío y zona de carga de imagen (Reto 05).
• Selector de modo de entrada: Texto, Voz o Imagen + Texto.
• Selector de modo de respuesta: Texto o Audio.
• Indicador de tool: cuando el agente activa una tool, el mensaje muestra el nombre de la tool.
Cuando responde directamente, sin indicador.
• Indicador de caché: cuando la respuesta viene del caché semántico (Reto 06), el mensaje muestra
un badge diferente al de tool — ej: 'n Caché' en verde o teal.
• Ambos indicadores son permanentes en el historial — no desaparecen tras la carga.
• Mensajes del coder y del agente con estilos visualmente distintos.
Verifica:
• La app corre en el navegador sin errores de consola.
• Enviar texto -> respuesta del agente en historial.
• Subir imagen + texto -> el agente analiza la imagen y responde.
• Activar modo Voz -> pipeline de Whisper se activa.
• Activar modo Audio -> respuesta se reproduce.
• Pregunta que activa una tool -> badge de tool visible en historial.
• Pregunta frecuente pre-cacheada -> badge 'n Caché' visible, diferente al de tool.
• Lovable.dev o v0.dev generan UIs de chat en segundos si describes los elementos que necesitas.

8. Reto Integrador: Todo conectado. El reto:
Con los 7 retos anteriores construidos, ejecuta la siguiente secuencia completa. Si algo falla, identifica el
punto exacto, corrígelo y continúa. Al final documenta con comentarios en el código las decisiones
técnicas que tomaste y los problemas que encontraste.
Secuencia de prueba — ejecútala completa:
# Retos del agente inteligente

| # | Acción | Qué debe ocurrir | Módulo activo |
|---|--------|------------------|---------------|
| 1 | Escribe en español: "Hola, soy Daniela, analista financiera" | Responde en español con tono formal. Recuerda el nombre. | Reto 01 Memoria |
| 2 | Escribe en inglés: "What is the current USD to COP rate?" | Cambia a inglés. Activa get_usd_rate(). Badge de tool en UI. | Reto 02 Tool |
| 3 | Escribe en español: "¿Cuánto es el horario de atención de FinBot?" | Hit en caché semántico. Badge "Caché" en UI. Sin llamar al LLM. | Reto 06 Caché |
| 4 | Adjunta imagen de extracto + "¿cuánto gasté en restaurantes este mes?" | Agente analiza la imagen y responde con datos del extracto visible. | Reto 05 Visión |
| 5 | Activa entrada de Voz → graba: "¿Cómo está el Bitcoin hoy?" | Audio transcrito aparece. Agente activa API externa. Respuesta en texto. | Reto 03 + 02 Voz + Tool |
| 6 | Escribe en español: "Según la web de FinBot, ¿cuáles son los CDTs disponibles?" | Agente consulta el RAG y responde con información de la URL indexada. | Reto 04 RAG |
| 7 | Activa salida de Audio + escribe en inglés: "Summarize what we discussed today" | Agente resume en inglés la conversación. Respuesta se reproduce como audio. | Reto 01 + 03 Memoria + Voz |
| 8 | Escribe en español: "¿Recuerdas cómo me llamo?" | El agente recuerda 'Daniela' del paso 1 de la sesión. | Reto 01 Memoria |

Al terminar la secuencia, documenta en el código:
• ¿Qué paso falló primero y cuál fue la causa raíz?
• ¿Qué decisión técnica cambiaste a mitad del camino y por qué?
• ¿Qué componente fue más difícil de integrar con el resto?