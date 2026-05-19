# Agente Conversacional Multimodal con App Web: VoiceAgent

## Caso de uso

Como **AI Automation Engineer**, construyes una aplicación web que integra un agente conversacional con IA.

Los usuarios interactúan con el agente escribiendo o hablando, y el agente responde en texto o voz según la preferencia seleccionada por el usuario. El agente tiene acceso a herramientas reales (*tools*) y la interfaz muestra visualmente cuándo el agente usa una herramienta y cuándo responde directamente.

El caso de uso concreto del agente lo define el estudiante. La web debe ser funcional, el agente inteligente y la experiencia conversacional de principio a fin.

## Requisitos funcionales

### 1. Aplicación web funcional

El estudiante construye una app web con interfaz conversacional. El stack es libre: React, Vue, HTML/JS u otro framework web.

- Interfaz de chat visible con historial de conversación.
- Campo de entrada de texto y botón de envío funcionales.
- Selector de modo de respuesta: texto o voz, mediante toggle o radio button visible en la UI.
- La app corre localmente con un solo comando o está desplegada en una URL pública.

### 2. Agente conversacional con IA

El agente puede construirse con LangChain, LangGraph, n8n, la Responses API de OpenAI, Anthropic o cualquier otro framework.

- Mantiene memoria de conversación y recuerda el contexto de los últimos 7 mensajes consecutivos de la misma sesión.
- Responde de forma coherente y contextual a las preguntas del usuario.
- Incluye un system prompt que define claramente rol, tono y restricciones del agente.
- El system prompt debe tener mínimo 5 instrucciones diferenciadas.

### 3. Mínimo 2 tools operativas

El agente tiene acceso a herramientas reales. Las herramientas pueden ser búsqueda web, calculadora, consulta a API externa, lectura de archivo, conversión de divisas o cualquier otra funcionalidad útil para el caso de uso elegido.

- Implementar mínimo 2 tools distintas.
- Documentar cada tool en el README.
- Cada tool debe tener nombre, descripción y parámetros claramente definidos en el código.
- El agente decide autónomamente cuándo usar cada tool según la pregunta del usuario.

### 4. Visualización del uso de tools en la UI

La interfaz web muestra de forma diferenciada si el agente está usando una tool o respondiendo directamente.

- Cuando el agente usa una tool, se muestra un indicador visual con el nombre de la herramienta activada.
- El indicador puede ser un badge, card, icono o sección coloreada.
- Cuando el agente no usa tools, la respuesta aparece como respuesta directa sin indicador.
- El indicador queda visible en el historial de chat, no solo durante la carga.

### 5. Respuesta multimodal: texto y voz

El agente responde en el modo seleccionado por el usuario.

- En modo texto, la respuesta aparece en el chat como mensaje de texto normal.
- En modo voz, la respuesta se sintetiza con ElevenLabs, OpenAI TTS u otro servicio TTS.
- El audio se reproduce automáticamente o mediante un botón de play en la UI.
- El usuario puede cambiar el modo en cualquier momento de la conversación.

## Puntos extra

**Máximo: 8 puntos**

### RAG sobre una web

Integrar un pipeline RAG usando el contenido de una URL como fuente de conocimiento para el agente.

- Hacer scraping o fetch del contenido de una URL configurable.
- Aplicar chunking.
- Generar embeddings.
- Almacenar la información en una base vectorial como Chroma, FAISS, Supabase, Pinecone u otra alternativa.
- El agente usa el retrieval como contexto adicional antes de responder preguntas relacionadas.
- La URL fuente debe estar documentada en el README.

## Entregables esperados

La entrega debe hacerse en un archivo `.zip` con el nombre:

```text
nombre-apellido-voiceagent.zip
```

El archivo `.zip` debe contener todo el desarrollo:

- Frontend.
- Backend.
- Flujo de n8n exportado en `.json`, si aplica.
- README con setup, uso, descripción de tools y caso de uso elegido.
- `.env.example` con todas las variables necesarias sin valores reales.

No se requiere una modularización específica. El código puede organizarse como se considere conveniente, siempre que esté documentado y sea ejecutable.

| Componente | Descripción | Verificación |
| --- | --- | --- |
| Archivo `.zip` + GitHub público | El `.zip` incluye todo el desarrollo: frontend, backend y flujo n8n, si aplica. Repo público. | Link al repo funcional y `.zip` entregado. |
| App web funcional | Frontend con chat, selector texto/voz e indicador de tools. Stack libre. | Corre con 1 comando o URL pública accesible. |
| Agente con 2+ tools | Código del agente con mínimo 2 tools documentadas y operativas. | Cada tool se activa con una pregunta real. |
| System prompt | Incluido en el código con rol, tono y restricciones definidos, mínimo 5 instrucciones. | Visible en el código o en archivo separado. |
| Síntesis de voz (TTS) | Integración con ElevenLabs, OpenAI TTS u otro servicio TTS. | Audio reproducible en la UI. |
| README.md en inglés | Setup, uso, descripción de tools y caso de uso elegido. | Se ejecuta siguiendo el README. |
| `.env.example` | Todas las variables necesarias sin valores reales. | Ninguna API key hardcodeada. |

## Criterios de aceptación

Cada criterio indica la rúbrica que afecta directamente.

| Criterio de aceptación | Rúbrica afectada |
| --- | --- |
| La app web corre y muestra la interfaz de chat en el navegador. | App web e integración con el agente. |
| El selector texto/voz funciona: cambiar el modo cambia el tipo de respuesta. | App web e integración con el agente. |
| El agente responde de forma coherente manteniendo contexto en 7 mensajes consecutivos. | Agente con tools y memoria. |
| Las 2 tools se activan con preguntas reales y funcionan correctamente. | Agente con tools y memoria. |
| El system prompt tiene mínimo 5 instrucciones diferenciadas: rol, tono y restricciones. | Agente con tools y memoria. |
| La UI diferencia visualmente respuestas con tool y respuestas directas del LLM. | Visualización de tools en la UI. |
| El indicador de tool queda visible en el historial de chat con el nombre de la tool. | Visualización de tools en la UI. |
| En modo voz se genera audio reproducible en la UI. | App web e integración con el agente. |
| Ninguna API key está hardcodeada en el repositorio. | Documentación. |
| El README permite instalar y ejecutar el proyecto desde cero. | Documentación. |
| Todo el código y la documentación están en inglés. | Documentación. |
| El estudiante explica sus decisiones técnicas durante la sustentación. | Sustentación. |
