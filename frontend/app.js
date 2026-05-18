// FinBot — Frontend with voice recording, image vision, and semantic cache indicators

// --- Configuration ---
const BACKEND_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://financiery-agent.onrender.com';

const API_URL = `${BACKEND_URL}/api/chat`;
const TRANSCRIBE_URL = `${BACKEND_URL}/api/transcribe`;

// --- Global state ---
let modoEntrada = 'text';          // 'text' | 'voice' | 'image'
let modoRespuesta = 'text';        // 'text' | 'audio'
let imagenActual = null;
let conversationHistory = [];      // In-memory history — never read from the DOM

// Voice recording state
let mediaRecorder = null;
let audioChunks = [];
let estaGrabando = false;

// --- DOM references ---
const contenedorMensajes = document.getElementById('messages');
const indicadorCargando = document.getElementById('loading');
const formularioChat = document.getElementById('chat-form');
const inputMensaje = document.getElementById('message-input');
const botonEnviar = document.getElementById('send-btn');
const inputImagen = document.getElementById('image-upload');
const previsualizacionImagen = document.getElementById('image-preview');
const botonesEntrada = document.querySelectorAll('.input-mode-btn');
const botonesRespuesta = document.querySelectorAll('.response-mode-btn');

const botonGrabar = document.getElementById('record-btn');
const statusGrabacion = document.getElementById('recording-status');
const seccionVoz = document.getElementById('voice-section');
const seccionImagen = document.getElementById('image-section');
const seccionAudioUpload = document.getElementById('audio-section-upload');

const audioUpload = document.getElementById('audio-upload');
const audioFilePreview = document.getElementById('audio-file-preview');

// --- Events ---

formularioChat.addEventListener('submit', function(evento) {
    evento.preventDefault();
    manejarEnvioMensaje();
});

// Input mode selector: Text / Voice / Image+Text
botonesEntrada.forEach(function(boton) {
    boton.addEventListener('click', function() {
        botonesEntrada.forEach(function(b) { b.classList.remove('active'); });
        boton.classList.add('active');
        modoEntrada = boton.dataset.inputMode;
        actualizarSeccionesEntrada();
    });
});

// Response mode selector: Text / Audio
botonesRespuesta.forEach(function(boton) {
    boton.addEventListener('click', function() {
        botonesRespuesta.forEach(function(b) { b.classList.remove('active'); });
        boton.classList.add('active');
        modoRespuesta = boton.dataset.responseMode;
    });
});

function actualizarSeccionesEntrada() {
    seccionVoz.classList.toggle('hidden', modoEntrada !== 'voice');
    seccionImagen.classList.toggle('hidden', modoEntrada !== 'image');
    seccionAudioUpload.classList.toggle('hidden', modoEntrada !== 'voice');
}

// Image upload: resize to max 800px and compress to 70% JPEG before sending
inputImagen.addEventListener('change', function(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = function(ev) {
        img.onload = function() {
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

            imagenActual = canvas.toDataURL('image/jpeg', 0.7);
            previsualizacionImagen.textContent = '📎 ' + archivo.name;
            previsualizacionImagen.classList.remove('hidden');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(archivo);
});

// Toggle recording on button click
botonGrabar.addEventListener('click', function() {
    if (estaGrabando) {
        pararGrabacion();
    } else {
        iniciarGrabacion();
    }
});

// Audio file upload: send directly to Whisper for transcription
audioUpload.addEventListener('change', async function(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    audioFilePreview.textContent = '🎵 ' + archivo.name;
    audioFilePreview.classList.remove('hidden');

    inputMensaje.value = 'Transcribiendo audio...';
    inputMensaje.disabled = true;
    deshabilitarInputs(true);

    try {
        const formData = new FormData();
        formData.append('audio', archivo);

        const respuesta = await fetch(TRANSCRIBE_URL, {
            method: 'POST',
            body: formData
        });

        if (!respuesta.ok) {
            throw new Error('HTTP error: ' + respuesta.status);
        }

        const datos = await respuesta.json();
        inputMensaje.value = datos.text;
        inputMensaje.focus();

    } catch (error) {
        console.error('Transcription error:', error);
        inputMensaje.value = '';
        alert('Error al transcribir el audio. Verifica que el archivo sea válido.');
    } finally {
        inputMensaje.disabled = false;
        deshabilitarInputs(false);
        audioUpload.value = '';
        audioFilePreview.classList.add('hidden');
    }
});

// --- Voice recording functions ---

async function iniciarGrabacion() {
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = function(evento) {
            audioChunks.push(evento.data);
        };

        mediaRecorder.onstop = function() {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            transcribirAudio(audioBlob);
        };

        mediaRecorder.start();
        estaGrabando = true;

        botonGrabar.textContent = '⏹️ Detener';
        botonGrabar.classList.add('recording');
        statusGrabacion.classList.remove('hidden');

    } catch (error) {
        console.error('Microphone access error:', error);
        alert('No se pudo acceder al micrófono. Por favor verifica los permisos.');
    }
}

function pararGrabacion() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        // Release the microphone stream
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        estaGrabando = false;

        botonGrabar.textContent = '🎤 Grabar voz';
        botonGrabar.classList.remove('recording');
        statusGrabacion.classList.add('hidden');
    }
}

// Send recorded audio blob to Whisper and populate the text input with the transcript
async function transcribirAudio(audioBlob) {
    inputMensaje.value = 'Transcribiendo audio...';
    inputMensaje.disabled = true;

    try {
        const formData = new FormData();
        // FormData sets Content-Type automatically — do not set it manually
        formData.append('audio', audioBlob, 'grabacion.webm');

        const respuesta = await fetch(TRANSCRIBE_URL, {
            method: 'POST',
            body: formData
        });

        if (!respuesta.ok) {
            throw new Error('Transcription error: ' + respuesta.status);
        }

        const datos = await respuesta.json();
        inputMensaje.value = datos.text;
        inputMensaje.disabled = false;
        inputMensaje.focus();

    } catch (error) {
        console.error('Transcription error:', error);
        inputMensaje.value = '';
        inputMensaje.disabled = false;
        alert('Error al transcribir el audio. Intenta de nuevo.');
    }
}

// Return the last 7 messages from in-memory history (never from the DOM)
function construirHistorial() {
    return conversationHistory.slice(-7);
}

// --- Chat functions ---

async function manejarEnvioMensaje() {
    const textoMensaje = inputMensaje.value.trim();

    if (!textoMensaje && !imagenActual) return;

    // Capture image reference before resetting the input — prevents race condition
    const imagenParaEnviar = imagenActual;

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

    // Snapshot history before pushing the new user message
    const historialParaEnviar = construirHistorial();
    conversationHistory.push({ role: 'user', content: textoMensaje });

    try {
        const respuesta = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: textoMensaje,
                messages: historialParaEnviar,
                image: imagenParaEnviar,
                mode: modoRespuesta
            })
        });

        if (!respuesta.ok) {
            throw new Error('HTTP error: ' + respuesta.status);
        }

        const datos = await respuesta.json();

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
        console.error('Send message error:', error);
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

// Render a message bubble with optional cache badge, tool badge, and latency badge
function agregarMensaje(opciones) {
    const { rol, contenido, imagen, desdeCache, toolUsada, latencia, esError } = opciones;

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

// Play TTS audio returned as a base64 data URL from the backend
function reproducirAudio(url) {
    const audio = new Audio(url);
    audio.play().catch(function(error) {
        console.error('Audio playback error:', error);
    });
}

// Initialization
window.addEventListener('DOMContentLoaded', function() {
    actualizarSeccionesEntrada();
    agregarMensaje({
        rol: 'assistant',
        contenido: '¡Hola! Soy FinBot, tu asistente financiero. ¿En qué puedo ayudarte hoy?'
    });
});
