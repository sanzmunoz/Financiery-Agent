// ============================================================
// FINBOT - FRONTEND CON GRABACIÓN DE VOZ
// ============================================================

// ------------------------------------------------------------
// CONFIGURACIÓN
// ------------------------------------------------------------
const BACKEND_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://TU-SERVICIO.onrender.com';  // reemplazar con tu URL de Render

const API_URL = `${BACKEND_URL}/api/chat`;
const TRANSCRIBE_URL = `${BACKEND_URL}/api/transcribe`;

// ------------------------------------------------------------
// VARIABLES GLOBALES
// ------------------------------------------------------------
let modoEntrada = 'text';          // 'text' | 'voice' | 'image'
let modoRespuesta = 'text';        // 'text' | 'audio'
let imagenActual = null;
let conversationHistory = [];      // Historial en memoria (no DOM)

// Variables para grabación de audio
let mediaRecorder = null;          // Objeto que graba el audio
let audioChunks = [];              // Pedazos de audio grabado
let estaGrabando = false;          // Estado de grabación

// ------------------------------------------------------------
// REFERENCIAS AL DOM
// ------------------------------------------------------------
const contenedorMensajes = document.getElementById('messages');
const indicadorCargando = document.getElementById('loading');
const formularioChat = document.getElementById('chat-form');
const inputMensaje = document.getElementById('message-input');
const botonEnviar = document.getElementById('send-btn');
const inputImagen = document.getElementById('image-upload');
const previsualizacionImagen = document.getElementById('image-preview');
const botonesEntrada = document.querySelectorAll('.input-mode-btn');
const botonesRespuesta = document.querySelectorAll('.response-mode-btn');

// Elementos de grabación y secciones de entrada
const botonGrabar = document.getElementById('record-btn');
const statusGrabacion = document.getElementById('recording-status');
const seccionVoz = document.getElementById('voice-section');
const seccionImagen = document.getElementById('image-section');
const seccionAudioUpload = document.getElementById('audio-section-upload');

const audioUpload = document.getElementById('audio-upload');
const audioFilePreview = document.getElementById('audio-file-preview');

// ============================================================
// EVENTOS
// ============================================================

// Enviar formulario
formularioChat.addEventListener('submit', function(evento) {
    evento.preventDefault();
    manejarEnvioMensaje();
});

// Cambiar modo de entrada (Texto / Voz / Imagen+Texto)
botonesEntrada.forEach(function(boton) {
    boton.addEventListener('click', function() {
        botonesEntrada.forEach(function(b) { b.classList.remove('active'); });
        boton.classList.add('active');
        modoEntrada = boton.dataset.inputMode;
        actualizarSeccionesEntrada();
        console.log('Modo entrada:', modoEntrada);
    });
});

// Cambiar modo de respuesta (Texto / Audio)
botonesRespuesta.forEach(function(boton) {
    boton.addEventListener('click', function() {
        botonesRespuesta.forEach(function(b) { b.classList.remove('active'); });
        boton.classList.add('active');
        modoRespuesta = boton.dataset.responseMode;
        console.log('Modo respuesta:', modoRespuesta);
    });
});

function actualizarSeccionesEntrada() {
    seccionVoz.classList.toggle('hidden', modoEntrada !== 'voice');
    seccionImagen.classList.toggle('hidden', modoEntrada !== 'image');
    seccionAudioUpload.classList.toggle('hidden', modoEntrada !== 'voice');
}

// Upload de imagen
// En el evento de imageInput.addEventListener('change', ...)

inputImagen.addEventListener('change', function(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const img = new Image();
  const reader = new FileReader();

  reader.onload = function(ev) {
    img.onload = function() {
      // Redimensionar y comprimir
      const canvas = document.createElement('canvas');
      const maxSize = 800;
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      // Guardar comprimida al 70%
      imagenActual = canvas.toDataURL('image/jpeg', 0.7);
      previsualizacionImagen.textContent = '📎 ' + archivo.name;
      previsualizacionImagen.classList.remove('hidden');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(archivo);
});

// ------------------------------------------------------------
// NUEVO: Botón de grabación
// ------------------------------------------------------------
botonGrabar.addEventListener('click', function() {
    if (estaGrabando) {
        // Si está grabando, parar
        pararGrabacion();
    } else {
        // Si no está grabando, iniciar
        iniciarGrabacion();
    }
});

// Evento: subir archivo de audio
audioUpload.addEventListener('change', async function(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  // Mostrar nombre del archivo
  audioFilePreview.textContent = '🎵 ' + archivo.name;
  audioFilePreview.classList.remove('hidden');

  // Mostrar estado de transcripción
  inputMensaje.value = 'Transcribiendo audio...';
  inputMensaje.disabled = true;
  deshabilitarInputs(true);

  try {
    // Enviar archivo a Whisper
    const formData = new FormData();
    formData.append('audio', archivo);

    const respuesta = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      body: formData
    });

    if (!respuesta.ok) {
      throw new Error('Error HTTP: ' + respuesta.status);
    }

    const datos = await respuesta.json();

    // Poner texto transcrito en el input
    inputMensaje.value = datos.text;
    inputMensaje.focus();

  } catch (error) {
    console.error('Error transcribiendo audio:', error);
    inputMensaje.value = '';
    alert('Error al transcribir el audio. Verifica que el archivo sea válido.');
  } finally {
    inputMensaje.disabled = false;
    deshabilitarInputs(false);
    // Limpiar input de archivo
    audioUpload.value = '';
    audioFilePreview.classList.add('hidden');
  }
});

// ============================================================
// FUNCIONES DE GRABACIÓN
// ============================================================

// ------------------------------------------------------------
// FUNCIÓN: Iniciar grabación de audio
// ------------------------------------------------------------
async function iniciarGrabacion() {
    try {
        // 1. PEDIR PERMISO PARA USAR EL MICRÓFONO
        // getUserMedia() pide acceso al micrófono del navegador
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true  // Solo audio, no video
        });

        // 2. CREAR EL GRABADOR
        mediaRecorder = new MediaRecorder(stream);

        // 3. RESETEAR EL ARRAY DE CHUNKS
        audioChunks = [];

        // 4. EVENTO: Cuando hay datos disponibles
        mediaRecorder.ondataavailable = function(evento) {
            // Guardar cada pedazo de audio
            audioChunks.push(evento.data);
        };

        // 5. EVENTO: Cuando termina la grabación
        mediaRecorder.onstop = function() {
            // Convertir los chunks a un Blob (archivo de audio)
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

            // Enviar a transcribir
            transcribirAudio(audioBlob);
        };

        // 6. INICIAR LA GRABACIÓN
        mediaRecorder.start();
        estaGrabando = true;

        // 7. ACTUALIZAR LA UI
        botonGrabar.textContent = '⏹️ Detener';
        botonGrabar.classList.add('recording');
        statusGrabacion.classList.remove('hidden');

        console.log('🎤 Grabación iniciada');

    } catch (error) {
        console.error('Error al acceder al micrófono:', error);
        alert('No se pudo acceder al micrófono. Por favor verifica los permisos.');
    }
}

// ------------------------------------------------------------
// FUNCIÓN: Parar grabación
// ------------------------------------------------------------
function pararGrabacion() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        // Detener el MediaRecorder
        mediaRecorder.stop();

        // Detener el stream del micrófono
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        estaGrabando = false;

        // Actualizar UI
        botonGrabar.textContent = '🎤 Grabar voz';
        botonGrabar.classList.remove('recording');
        statusGrabacion.classList.add('hidden');

        console.log('⏹️ Grabación detenida');
    }
}

// ------------------------------------------------------------
// FUNCIÓN: Transcribir audio con Whisper
// ------------------------------------------------------------
async function transcribirAudio(audioBlob) {
    // Mostrar indicador de "procesando..."
    inputMensaje.value = 'Transcribiendo audio...';
    inputMensaje.disabled = true;

    try {
        // 1. CREAR FormData (para enviar archivos)
        const formData = new FormData();
        formData.append('audio', audioBlob, 'grabacion.webm');

        // 2. ENVIAR AL BACKEND
        const respuesta = await fetch(TRANSCRIBE_URL, {
            method: 'POST',
            body: formData  // NO poner Content-Type, FormData lo maneja
        });

        if (!respuesta.ok) {
            throw new Error('Error en transcripción: ' + respuesta.status);
        }

        // 3. OBTENER LA TRANSCRIPCIÓN
        const datos = await respuesta.json();

        // 4. PONER EL TEXTO TRANSCRITO EN EL INPUT
        inputMensaje.value = datos.text;
        inputMensaje.disabled = false;
        inputMensaje.focus();

        console.log('✅ Transcripción:', datos.text);

    } catch (error) {
        console.error('Error al transcribir:', error);
        inputMensaje.value = '';
        inputMensaje.disabled = false;
        alert('Error al transcribir el audio. Intenta de nuevo.');
    }
}

// ------------------------------------------------------------
// FUNCIÓN: Construir historial de los últimos 7 mensajes
// Lee de conversationHistory[], NO del DOM
// ------------------------------------------------------------
function construirHistorial() {
    return conversationHistory.slice(-7);
}

// ============================================================
// FUNCIONES DE CHAT
// ============================================================

async function manejarEnvioMensaje() {
    const textoMensaje = inputMensaje.value.trim();

    if (!textoMensaje && !imagenActual) {
        return;
    }

    // Capturar imagen ANTES de cualquier reset (Fix 1)
    const imagenParaEnviar = imagenActual;

    // Guardar mensaje del usuario en historial en memoria

    agregarMensaje({
        rol: 'user',
        contenido: textoMensaje,
        imagen: imagenParaEnviar
    });

    inputMensaje.value = '';
    imagenActual = null;
    inputImagen.value = '';
    previsualizacionImagen.classList.add('hidden');

    mostrarCargando(true);
    deshabilitarInputs(true);

    const historialParaEnviar = construirHistorial();
    conversationHistory.push({ role: 'user', content: textoMensaje });

    try {
        const respuesta = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: textoMensaje,
                messages: historialParaEnviar,
                image: imagenParaEnviar,
                mode: modoRespuesta
            })
        });

        if (!respuesta.ok) {
            throw new Error('Error HTTP: ' + respuesta.status);
        }

        const datos = await respuesta.json();

        // Guardar respuesta del asistente en historial en memoria
        conversationHistory.push({ role: 'assistant', content: datos.response });

        agregarMensaje({
            rol: 'assistant',
            contenido: datos.response,
            desdeCache: datos.from_cache,
            toolUsada: datos.tool_used,
            latencia: datos.latency,
            urlAudio: datos.audio_url
        });

        if (datos.audio_url && modoRespuesta === 'audio') {
            reproducirAudio(datos.audio_url);
        }

    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        agregarMensaje({
            rol: 'assistant',
            contenido: 'Lo siento, ocurrió un error. Por favor intenta de nuevo.',
            esError: true
        });
    } finally {
        mostrarCargando(false);
        deshabilitarInputs(false);
        inputMensaje.focus();
    }
}

function agregarMensaje(opciones) {
    const {
        rol,
        contenido,
        imagen,
        desdeCache,
        toolUsada,
        latencia,
        esError
    } = opciones;

    const divMensaje = document.createElement('div');
    divMensaje.className = 'message ' + rol;

    const divContenido = document.createElement('div');
    divContenido.className = 'message-content';
    divContenido.textContent = contenido;
    divMensaje.appendChild(divContenido);

    if (rol === 'user' && imagen) {
        const imgElemento = document.createElement('img');
        imgElemento.src = imagen;
        imgElemento.className = 'message-image';
        divMensaje.appendChild(imgElemento);
    }

    if (rol === 'assistant' && !esError) {
        const divBadges = document.createElement('div');
        divBadges.className = 'badges';

        if (desdeCache) {
            const badgeCache = document.createElement('span');
            badgeCache.className = 'badge cache';
            badgeCache.textContent = '⚡ Caché';
            divBadges.appendChild(badgeCache);
        }

        if (toolUsada) {
            const badgeTool = document.createElement('span');
            badgeTool.className = 'badge tool';
            badgeTool.textContent = '🔧 ' + toolUsada;
            divBadges.appendChild(badgeTool);
        }

        if (latencia) {
            const badgeLatencia = document.createElement('span');
            badgeLatencia.className = 'badge latency';
            badgeLatencia.textContent = latencia + 'ms';
            divBadges.appendChild(badgeLatencia);
        }

        if (divBadges.children.length > 0) {
            divMensaje.appendChild(divBadges);
        }
    }

    contenedorMensajes.appendChild(divMensaje);
    hacerScrollAbajo();
}

function mostrarCargando(mostrar) {
    if (mostrar) {
        indicadorCargando.classList.remove('hidden');
        hacerScrollAbajo();
    } else {
        indicadorCargando.classList.add('hidden');
    }
}

function deshabilitarInputs(deshabilitar) {
    inputMensaje.disabled = deshabilitar;
    botonEnviar.disabled = deshabilitar;
    inputImagen.disabled = deshabilitar;
    botonGrabar.disabled = deshabilitar;

    botonesEntrada.forEach(function(b) { b.disabled = deshabilitar; });
    botonesRespuesta.forEach(function(b) { b.disabled = deshabilitar; });
}

function hacerScrollAbajo() {
    const contenedorChat = document.querySelector('.chat-container');
    contenedorChat.scrollTop = contenedorChat.scrollHeight;
}

function reproducirAudio(url) {
    const audio = new Audio(url);
    audio.play().catch(function(error) {
        console.error('Error al reproducir audio:', error);
    });
}

// Inicialización
window.addEventListener('DOMContentLoaded', function() {
    actualizarSeccionesEntrada();
    agregarMensaje({
        rol: 'assistant',
        contenido: '¡Hola! Soy FinBot, tu asistente financiero. ¿En qué puedo ayudarte hoy?'
    });
});