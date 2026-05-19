// Financial Agent — Frontend with voice recording, image vision, and semantic cache indicators

// --- Configuration ---
const BACKEND_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://financiery-agent.onrender.com';

const API_URL = `${BACKEND_URL}/api/chat`;
const TRANSCRIBE_URL = `${BACKEND_URL}/api/transcribe`;

// --- Global state ---
let inputMode = 'text';          // 'text' | 'voice' | 'image'
let responseMode = 'text';       // 'text' | 'audio'
let currentImage = null;
let conversationHistory = [];    // In-memory history — never read from the DOM

// Voice recording state
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// --- DOM references ---
const messagesContainer = document.getElementById('messages');
const loadingIndicator = document.getElementById('loading');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const imageInput = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const inputModeButtons = document.querySelectorAll('.input-mode-btn');
const responseModeButtons = document.querySelectorAll('.response-mode-btn');

const recordBtn = document.getElementById('record-btn');
const recordingStatus = document.getElementById('recording-status');
const voiceSection = document.getElementById('voice-section');
const imageSection = document.getElementById('image-section');
const audioUploadSection = document.getElementById('audio-section-upload');

const audioUpload = document.getElementById('audio-upload');
const audioFilePreview = document.getElementById('audio-file-preview');

// --- Events ---

chatForm.addEventListener('submit', function(event) {
    event.preventDefault();
    handleSendMessage();
});

// Input mode selector: Text / Voice / Image+Text
inputModeButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
        inputModeButtons.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        inputMode = btn.dataset.inputMode;
        updateInputSections();
    });
});

// Response mode selector: Text / Audio
responseModeButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
        responseModeButtons.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        responseMode = btn.dataset.responseMode;
    });
});

function updateInputSections() {
    voiceSection.classList.toggle('hidden', inputMode !== 'voice');
    imageSection.classList.toggle('hidden', inputMode !== 'image');
    audioUploadSection.classList.toggle('hidden', inputMode !== 'voice');
}

// Image upload: resize to max 800px and compress to 70% JPEG before sending
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

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

            currentImage = canvas.toDataURL('image/jpeg', 0.7);
            imagePreview.textContent = file.name;
            imagePreview.classList.remove('hidden');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// Toggle recording on button click
recordBtn.addEventListener('click', function() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// Audio file upload: send directly to Whisper for transcription
audioUpload.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    audioFilePreview.textContent = file.name;
    audioFilePreview.classList.remove('hidden');

    messageInput.value = 'Transcribiendo audio...';
    messageInput.disabled = true;
    disableInputs(true);

    try {
        const formData = new FormData();
        formData.append('audio', file);

        const response = await fetch(TRANSCRIBE_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('HTTP error: ' + response.status);
        }

        const data = await response.json();
        messageInput.value = data.text;
        messageInput.focus();

    } catch (error) {
        console.error('Transcription error:', error);
        messageInput.value = '';
        alert('Error al transcribir el audio. Verifica que el archivo sea válido.');
    } finally {
        messageInput.disabled = false;
        disableInputs(false);
        audioUpload.value = '';
        audioFilePreview.classList.add('hidden');
    }
});

// --- Voice recording functions ---

async function startRecording() {
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = function(event) {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = function() {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            transcribeAudio(audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;

        recordBtn.textContent = 'Stop';
        recordBtn.classList.add('recording');
        recordingStatus.classList.remove('hidden');

    } catch (error) {
        console.error('Microphone access error:', error);
        alert('No se pudo acceder al micrófono. Por favor verifica los permisos.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        // Release the microphone stream
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        isRecording = false;

        recordBtn.textContent = 'Record voice';
        recordBtn.classList.remove('recording');
        recordingStatus.classList.add('hidden');
    }
}

// Send recorded audio blob to Whisper and populate the text input with the transcript
async function transcribeAudio(audioBlob) {
    messageInput.value = 'Transcribiendo audio...';
    messageInput.disabled = true;

    try {
        const formData = new FormData();
        // FormData sets Content-Type automatically — do not set it manually
        formData.append('audio', audioBlob, 'recording.webm');

        const response = await fetch(TRANSCRIBE_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Transcription error: ' + response.status);
        }

        const data = await response.json();
        messageInput.value = data.text;
        messageInput.disabled = false;
        messageInput.focus();

    } catch (error) {
        console.error('Transcription error:', error);
        messageInput.value = '';
        messageInput.disabled = false;
        alert('Error al transcribir el audio. Intenta de nuevo.');
    }
}

// Return the last 7 messages from in-memory history (never from the DOM)
function buildHistory() {
    return conversationHistory.slice(-7);
}

// --- Chat functions ---

async function handleSendMessage() {
    const messageText = messageInput.value.trim();

    if (!messageText && !currentImage) return;

    // Capture image reference before resetting the input — prevents race condition
    const imageToSend = currentImage;

    addMessage({
        role: 'user',
        content: messageText,
        image: imageToSend
    });

    messageInput.value = '';
    currentImage = null;
    imageInput.value = '';
    imagePreview.classList.add('hidden');

    showLoading(true);
    disableInputs(true);

    // Snapshot history before pushing the new user message
    const historyToSend = buildHistory();
    conversationHistory.push({ role: 'user', content: messageText });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: messageText,
                messages: historyToSend,
                image: imageToSend,
                mode: responseMode
            })
        });

        if (!response.ok) {
            throw new Error('HTTP error: ' + response.status);
        }

        const data = await response.json();

        conversationHistory.push({ role: 'assistant', content: data.response });

        addMessage({
            role: 'assistant',
            content: data.response,
            fromCache: data.from_cache,
            toolUsed: data.tool_used,
            latency: data.latency,
            audioUrl: data.audio_url
        });

        if (data.audio_url && responseMode === 'audio') {
            playAudio(data.audio_url);
        }

    } catch (error) {
        console.error('Send message error:', error);
        addMessage({
            role: 'assistant',
            content: 'Lo siento, ocurrió un error. Por favor intenta de nuevo.',
            isError: true
        });
    } finally {
        showLoading(false);
        disableInputs(false);
        messageInput.focus();
    }
}

// Render a message bubble with optional cache badge, tool badge, and latency badge
function addMessage(options) {
    const { role, content, image, fromCache, toolUsed, latency, isError } = options;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + role;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    messageDiv.appendChild(contentDiv);

    if (role === 'user' && image) {
        const imgEl = document.createElement('img');
        imgEl.src = image;
        imgEl.className = 'message-image';
        messageDiv.appendChild(imgEl);
    }

    if (role === 'assistant' && !isError) {
        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'badges';

        if (fromCache) {
            const cacheLabel = document.createElement('span');
            cacheLabel.className = 'badge cache';
            cacheLabel.textContent = 'Cache';
            badgesDiv.appendChild(cacheLabel);
        }

        if (toolUsed) {
            const toolLabel = document.createElement('span');
            toolLabel.className = 'badge tool';
            toolLabel.textContent = toolUsed;
            badgesDiv.appendChild(toolLabel);
        }

        if (latency) {
            const latencyLabel = document.createElement('span');
            latencyLabel.className = 'badge latency';
            latencyLabel.textContent = latency + 'ms';
            badgesDiv.appendChild(latencyLabel);
        }

        if (badgesDiv.children.length > 0) {
            messageDiv.appendChild(badgesDiv);
        }
    }

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showLoading(show) {
    if (show) {
        loadingIndicator.classList.remove('hidden');
        scrollToBottom();
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

function disableInputs(disable) {
    messageInput.disabled = disable;
    sendBtn.disabled = disable;
    imageInput.disabled = disable;
    recordBtn.disabled = disable;
    inputModeButtons.forEach(function(b) { b.disabled = disable; });
    responseModeButtons.forEach(function(b) { b.disabled = disable; });
}

function scrollToBottom() {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Play TTS audio returned as a base64 data URL from the backend
function playAudio(url) {
    const audio = new Audio(url);
    audio.play().catch(function(error) {
        console.error('Audio playback error:', error);
    });
}

// Initialization
window.addEventListener('DOMContentLoaded', function() {
    updateInputSections();
    addMessage({
        role: 'assistant',
        content: '¡Hola! Soy tu Agente Financiero. ¿En qué puedo ayudarte hoy?'
    });
    initCoinCursor();
});

// Custom coin cursor — visible when the pointer is outside the chat and input areas
function initCoinCursor() {
    const coinCursor  = document.getElementById('coin-cursor');
    const chatArea    = document.querySelector('.chat-container');
    const inputArea   = document.querySelector('.input-form');
    const header      = document.querySelector('.header');

    document.addEventListener('mousemove', function(e) {
        coinCursor.style.left = e.clientX + 'px';
        coinCursor.style.top  = e.clientY + 'px';
    });

    document.addEventListener('mouseover', function(e) {
        const insideInteractive =
            chatArea.contains(e.target) ||
            inputArea.contains(e.target) ||
            header.contains(e.target);

        if (insideInteractive) {
            coinCursor.style.display = 'none';
            document.body.style.cursor = '';
        } else {
            coinCursor.style.display = 'block';
            document.body.style.cursor = 'none';
        }
    });

    // Restore cursor when the mouse leaves the window
    document.addEventListener('mouseleave', function() {
        coinCursor.style.display = 'none';
        document.body.style.cursor = '';
    });
}
