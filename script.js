/**
 * LyricFlow - Core Logic
 */

// State
const state = {
    audio: new Audio(),
    audioContext: null,
    analyser: null,
    source: null,

    lyrics: [], // Array of strings (lines)
    syncedLyrics: [], // Array of { text: string, time: number }

    isPlaying: false,
    isRecording: false,
    isSyncing: false,

    currentLineIndex: 0,
    startTime: 0,
    pausedAt: 0,

    style: 'neon',
    bgColor: '#0f172a',
    textColor: '#ffffff',
    accentColor: '#10b981',
    fontSize: 40,

    mediaRecorder: null,
    recordedChunks: [],

    canvas: null,
    ctx: null,

    lastFrameTime: 0,
    animationId: null
};

// DOM Elements
const elements = {
    audioUpload: document.getElementById('audio-upload'),
    fileName: document.getElementById('file-name'),
    searchBtn: document.getElementById('search-btn'),
    trackSearch: document.getElementById('track-search'),
    lyricsInput: document.getElementById('lyrics-input'),

    playPauseBtn: document.getElementById('play-pause-btn'),
    syncModeBtn: document.getElementById('sync-mode-btn'),
    tapBtn: document.getElementById('tap-btn'),
    previewBtn: document.getElementById('preview-btn'),
    exportBtn: document.getElementById('export-btn'),

    styleItems: document.querySelectorAll('.style-item'),
    bgColorInput: document.getElementById('bg-color'),
    textColorInput: document.getElementById('text-color'),
    accentColorInput: document.getElementById('accent-color'),
    fontSizeInput: document.getElementById('font-size'),

    canvas: document.getElementById('video-canvas'),
    timeDisplay: document.querySelector('.time-display'),
    syncOverlay: document.getElementById('sync-overlay'),
    currentSyncWord: document.querySelector('.current-word'),
    nextLineSync: document.querySelector('.next-line'),
    statusMsg: document.getElementById('status-msg')
};

// Initialize
function init() {
    state.canvas = elements.canvas;
    state.ctx = state.canvas.getContext('2d');

    // Set initial canvas size relative logic (internal resolution is fixed 1080x1920)
    // CSS handles display size.

    setupEventListeners();
    animate();
}

function setupEventListeners() {
    // Audio Upload
    elements.audioUpload.addEventListener('change', handleAudioUpload);

    // Lyrics Search
    elements.searchBtn.addEventListener('click', handleLyricsSearch);

    // Lyrics Input
    elements.lyricsInput.addEventListener('input', (e) => {
        state.lyrics = e.target.value.split('\n').filter(line => line.trim() !== '');
        // Reset sync if lyrics change significantly
        if (state.syncedLyrics.length !== state.lyrics.length) {
            state.syncedLyrics = state.lyrics.map(text => ({ text, time: 0 }));
        }
    });

    // Styles
    elements.styleItems.forEach(item => {
        item.addEventListener('click', () => {
            elements.styleItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            state.style = item.dataset.style;
        });
    });

    // Colors & Fonts
    elements.bgColorInput.addEventListener('input', (e) => state.bgColor = e.target.value);
    elements.textColorInput.addEventListener('input', (e) => state.textColor = e.target.value);
    elements.accentColorInput.addEventListener('input', (e) => state.accentColor = e.target.value);
    elements.fontSizeInput.addEventListener('input', (e) => state.fontSize = parseInt(e.target.value));

    // Controls
    elements.playPauseBtn.addEventListener('click', togglePlay);
    elements.syncModeBtn.addEventListener('click', startSyncMode);
    elements.tapBtn.addEventListener('click', handleSyncTap);
    elements.previewBtn.addEventListener('click', previewVideo);
    elements.exportBtn.addEventListener('click', exportVideo);

    // Spacebar for sync tap
    document.addEventListener('keydown', (e) => {
        if (state.isSyncing && e.code === 'Space') {
            e.preventDefault();
            handleSyncTap();
        }
    });

    // Audio ended
    state.audio.addEventListener('ended', () => {
        state.isPlaying = false;
        elements.playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (state.isSyncing) stopSyncMode();
    });
}

// --- Logic Functions ---

function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (file) {
        elements.fileName.textContent = file.name;
        state.audio.src = URL.createObjectURL(file);
        // Reset
        state.syncedLyrics = [];
        showStatus('Audio cargado. Ahora agrega la letra.');
    }
}

async function handleLyricsSearch() {
    const query = elements.trackSearch.value;
    if (!query) return;

    showStatus('Buscando letra...');
    // Simple parsing of "Artist - Title"
    let artist = '', title = query;
    if (query.includes('-')) {
        [artist, title] = query.split('-').map(s => s.trim());
    }

    try {
        let url = `https://api.lyrics.ovh/v1/${artist}/${title}`;
        if (!artist) {
            // Fallback for simple search if needed? The API requires artist.
            // For now assume user formats correctly or we use a different mechanism.
            // Let's rely on user Input mostly, this is a helper.
            showStatus('Formato: "Artista - Cancion"');
            return;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.lyrics) {
            elements.lyricsInput.value = data.lyrics;
            state.lyrics = data.lyrics.split('\n').filter(line => line.trim() !== '');
            // Initialize sync array
            state.syncedLyrics = state.lyrics.map(text => ({ text, time: -1 }));
            showStatus('Letra encontrada!');
        } else {
            showStatus('Letra no encontrada. Intenta pegar manualmente.');
        }
    } catch (e) {
        console.error(e);
        showStatus('Error buscando letra.');
    }
}

// --- Playback & Animation ---

function togglePlay() {
    if (state.isPlaying) {
        state.audio.pause();
        state.isPlaying = false;
        elements.playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
        state.audio.play();
        state.isPlaying = true;
        elements.playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
}

// --- Sync Mode ---

function startSyncMode() {
    if (!state.audio.src) {
        alert('Sube una canción primero');
        return;
    }
    if (state.lyrics.length === 0) {
        alert('Agrega la letra primero');
        return;
    }

    state.isSyncing = true;
    state.currentLineIndex = 0;

    // Clear previous sync
    state.syncedLyrics = state.lyrics.map(text => ({ text, time: -1 }));

    elements.syncOverlay.classList.remove('hidden');
    elements.currentSyncWord.textContent = "Presiona TAP al empezar la primera línea";
    elements.nextLineSync.textContent = state.lyrics[0] || "";

    state.audio.currentTime = 0;
    state.audio.play();
    state.isPlaying = true;
}

function handleSyncTap() {
    if (!state.isSyncing) return;

    const time = state.audio.currentTime;

    // Check if we finished
    if (state.currentLineIndex >= state.syncedLyrics.length) {
        stopSyncMode();
        return;
    }

    // Save time for current line
    state.syncedLyrics[state.currentLineIndex].time = time;

    // Advance UI
    state.currentLineIndex++;

    // Update display
    if (state.currentLineIndex < state.syncedLyrics.length) {
        elements.currentSyncWord.textContent = state.syncedLyrics[state.currentLineIndex - 1].text; // Show what we just tapped
        elements.nextLineSync.textContent = state.syncedLyrics[state.currentLineIndex].text; // Show next

        // Visual feedback
        elements.tapBtn.style.transform = 'scale(0.95)';
        setTimeout(() => elements.tapBtn.style.transform = 'scale(1)', 50);
    } else {
        elements.currentSyncWord.textContent = "¡Fin!";
        setTimeout(stopSyncMode, 1000);
    }
}

function stopSyncMode() {
    state.isSyncing = false;
    elements.syncOverlay.classList.add('hidden');
    state.audio.pause();
    state.isPlaying = false;
    showStatus('Sincronización completada.');
}

// --- Visualizer & Rendering ---

function animate() {
    requestAnimationFrame(animate);

    const now = state.audio.currentTime;
    const duration = state.audio.duration || 60;

    // Update Time Display
    let mins = Math.floor(now / 60);
    let secs = Math.floor(now % 60);
    elements.timeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    renderCanvas(now);
}

function renderCanvas(time) {
    const w = state.canvas.width;
    const h = state.canvas.height;
    const ctx = state.ctx;

    // 1. Background
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);

    // Dynamic background effect based on Audio (simulated for now, real analyser takes more setup)
    if (state.isPlaying) {
        // Subtle pulsing
        const beat = (Math.sin(time * 10) + 1) / 2;
        ctx.fillStyle = adjustColorOpacity(state.accentColor, 0.1 + (beat * 0.05));
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w * 0.4 + (beat * 50), 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. Lyrics
    renderLyrics(ctx, time, w, h);

    // 3. Watermark
    ctx.font = '300 30px "Outfit"';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'right';
    ctx.fillText('videolyrics', w - 40, h - 40);
}

function renderLyrics(ctx, time, w, h) {
    if (state.syncedLyrics.length === 0) return;

    // Find active line
    // We want to show lines that have passed time, but mostly the *current* one.
    // Simple logic: Find the last line where line.time <= current_time

    let activeIndex = -1;
    for (let i = 0; i < state.syncedLyrics.length; i++) {
        if (state.syncedLyrics[i].time <= time && state.syncedLyrics[i].time !== -1) {
            activeIndex = i;
        } else {
            break;
        }
    }

    if (activeIndex === -1) return;

    const activeLine = state.syncedLyrics[activeIndex];
    const prevLine = state.syncedLyrics[activeIndex - 1];
    const nextLine = state.syncedLyrics[activeIndex + 1];

    ctx.textAlign = 'center';

    // RENDER: Active Line
    ctx.font = `700 ${state.fontSize * 2}px "${getFontForStyle(state.style)}"`;

    // Style: NEON
    if (state.style === 'neon') {
        ctx.shadowColor = state.accentColor;
        ctx.shadowBlur = 40;
        ctx.fillStyle = 'white';
        // Add text wrap logic if needed, simplied for now to 1 line
        ctx.fillText(activeLine.text, w / 2, h / 2);
        ctx.shadowBlur = 0;
    }
    // Style: KINETIC
    else if (state.style === 'kinetic') {
        const beat = (Math.sin(time * 20));
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(beat * 0.02);
        ctx.scale(1 + Math.abs(beat) * 0.05, 1 + Math.abs(beat) * 0.05);
        ctx.fillStyle = state.textColor;
        ctx.fillText(activeLine.text, 0, 0);
        ctx.restore();
    }
    // Style: RETRO
    else if (state.style === 'retro') {
        ctx.fillStyle = state.accentColor;
        ctx.fillText(activeLine.text, w / 2 + 5, h / 2 + 5);
        ctx.fillStyle = state.textColor;
        ctx.fillText(activeLine.text, w / 2, h / 2);
    }
    // Style: CLEAN
    else {
        ctx.fillStyle = state.textColor;
        ctx.fillText(activeLine.text, w / 2, h / 2);
    }

    // RENDER: Next/Prev lines (Faded)
    ctx.font = `400 ${state.fontSize}px "${getFontForStyle(state.style)}"`;
    ctx.fillStyle = adjustColorOpacity(state.textColor, 0.3);

    /*
    if (nextLine && nextLine.time !== -1) {
        ctx.fillText(nextLine.text, w/2, h/2 + 150);
    }
    */
}

// --- Utils ---

function getFontForStyle(style) {
    if (style === 'retro') return 'Space Grotesk';
    return 'Outfit';
}

function adjustColorOpacity(hex, opacity) {
    let tempHex = hex.replace('#', '');
    let r = parseInt(tempHex.substring(0, 2), 16);
    let g = parseInt(tempHex.substring(2, 4), 16);
    let b = parseInt(tempHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// --- Export Logic ---

function previewVideo() {
    state.audio.currentTime = 0;
    state.audio.play();
    state.isPlaying = true;
}

function exportVideo() {
    if (!state.audio.src) return;

    showStatus("Preparando exportación...");
    state.audio.pause();
    state.audio.currentTime = 0;
    state.isPlaying = false;

    // Setup MediaRecorder
    const stream = state.canvas.captureStream(30); // 30 FPS

    // Create Audio Pipeline
    // To mix audio into the recorded video, we need Web Audio API
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const actx = new AudioContext();
    const dest = actx.createMediaStreamDestination();
    const sourceNode = actx.createMediaElementSource(state.audio);
    sourceNode.connect(dest);
    sourceNode.connect(actx.destination); // Also play to speakers

    // Add audio track to stream
    const audioTrack = dest.stream.getAudioTracks()[0];
    stream.addTrack(audioTrack);

    state.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
    });

    state.recordedChunks = [];
    state.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) state.recordedChunks.push(e.data);
    };

    state.mediaRecorder.onstop = () => {
        showStatus("Generando archivo...");
        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'lyric-video.webm';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showStatus("¡Descarga lista! (" + blob.size + " bytes)");

        // Cleanup audio graph to allow normal replay
        // Note: createMediaElementSource can only be used once per element usually. 
        // Ideally we keep the graph alive or clone element. Simple Hack: Reload page or warn.
        // Better: Just leave it connected.
    };

    // Start Recording
    state.mediaRecorder.start();
    state.audio.play();
    state.isPlaying = true;
    showStatus("Grabando... Espera al final.");

    // Auto stop when audio ends
    state.audio.onended = () => {
        if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
            state.mediaRecorder.stop();
            state.audio.onended = null; // reset
        }
    };
}

// Start
init();
