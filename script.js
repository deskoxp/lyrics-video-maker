/**
 * LyricFlow PRO - Video Engine
 */

const state = {
    // Media
    audio: new Audio(),
    backgroundVideo: document.createElement('video'), // Hidden video element
    backgroundImage: null, // Image object
    bgType: 'none', // 'video', 'image', 'none'

    // Data
    lyrics: [],
    syncedLyrics: [], // [{ text, time }]

    // Playback
    isPlaying: false,
    isSyncing: false,
    startTime: 0,

    // Settings
    config: {
        bg: { blur: 0, darken: 50, scale: 1 },
        text: {
            style: 'neon',
            animation: 'fade',
            color: '#ffffff',
            accent: '#00f3ff',
            shadow: '#bc13fe',
            size: 50
        },
        fx: { particles: false, vignette: true, grain: false }
    },

    // Rendering
    canvas: null,
    ctx: null,
    particles: [],

    // Recorder
    mediaRecorder: null,
    recordedChunks: []
};

// DOM Elements
const dom = {};

function init() {
    // Cache DOM
    const ids = [
        'audio-upload', 'file-name', 'bg-upload', 'bg-file-name',
        'track-search', 'search-btn', 'lyrics-input',
        'bg-blur', 'bg-darken', 'bg-scale',
        'val-blur', 'val-darken', 'val-scale',
        'fx-particles', 'fx-vignette', 'fx-grain',
        'text-animation', 'text-color', 'accent-color', 'shadow-color', 'font-size',
        'sync-mode-btn', 'preview-btn', 'export-btn', 'play-pause-btn', 'status-msg',
        'video-canvas', 'sync-overlay', 'tap-btn', 'video-canvas',
        'sync-current-text', 'sync-next-text', 'progress-fill'
    ];
    ids.forEach(id => dom[id] = document.getElementById(id));

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    // Style Selectors
    document.querySelectorAll('.style-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.style-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            state.config.text.style = opt.dataset.style;
        });
    });

    state.canvas = dom['video-canvas'];
    state.ctx = state.canvas.getContext('2d');

    // Setup BG Video
    state.backgroundVideo.loop = true;
    state.backgroundVideo.muted = true;
    state.backgroundVideo.crossOrigin = "anonymous";
    state.backgroundVideo.playsInline = true;

    setupEvents();
    requestAnimationFrame(loop);
}

function setupEvents() {
    // Audio
    dom['audio-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        state.audio.src = URL.createObjectURL(file);
        dom['file-name'].textContent = file.name;
        dom['status-msg'].textContent = "Audio cargado.";
        // Reset sync
        state.syncedLyrics = [];
    });

    // Background Input
    dom['bg-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        dom['bg-file-name'].textContent = file.name;

        if (file.type.startsWith('video')) {
            state.backgroundVideo.src = url;
            state.bgType = 'video';
            state.backgroundImage = null;
            state.backgroundVideo.play(); // Play initially to load texture then pause?
        } else {
            const img = new Image();
            img.src = url;
            state.backgroundImage = img;
            state.bgType = 'image';
        }
    });

    // Settings Inputs (Generic handler for sliders/colors)
    const updateConfig = () => {
        state.config.bg.blur = parseInt(dom['bg-blur'].value);
        state.config.bg.darken = parseInt(dom['bg-darken'].value);
        state.config.bg.scale = parseInt(dom['bg-scale'].value) / 100;

        dom['val-blur'].innerText = state.config.bg.blur + 'px';
        dom['val-darken'].innerText = state.config.bg.darken + '%';
        dom['val-scale'].innerText = Math.round(state.config.bg.scale * 100) + '%';

        state.config.text.animation = dom['text-animation'].value;
        state.config.text.color = dom['text-color'].value;
        state.config.text.accent = dom['accent-color'].value;
        state.config.text.shadow = dom['shadow-color'].value;
        state.config.text.size = parseInt(dom['font-size'].value);

        state.config.fx.particles = dom['fx-particles'].checked;
        state.config.fx.vignette = dom['fx-vignette'].checked;
        state.config.fx.grain = dom['fx-grain'].checked;
    };

    // Bind all inputs
    ['bg-blur', 'bg-darken', 'bg-scale', 'text-animation', 'text-color', 'accent-color', 'shadow-color', 'font-size']
        .forEach(id => dom[id].addEventListener('input', updateConfig));
    ['fx-particles', 'fx-vignette', 'fx-grain']
        .forEach(id => dom[id].addEventListener('change', updateConfig));

    // Lyrics Search
    dom['search-btn'].addEventListener('click', async () => {
        const query = dom['track-search'].value;
        if (!query) return;
        const [artist, title] = query.split('-').map(s => s.trim());
        if (!artist) { dom['status-msg'].textContent = "Formato: Artista - Canción"; return; }

        dom['status-msg'].textContent = "Buscando letra...";
        try {
            const res = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
            const data = await res.json();
            if (data.lyrics) {
                dom['lyrics-input'].value = data.lyrics;
                parseLyricsFromInput();
                dom['status-msg'].textContent = "Letra cargada.";
            } else {
                dom['status-msg'].textContent = "Letra no encontrada.";
            }
        } catch (e) { console.error(e); }
    });

    dom['lyrics-input'].addEventListener('input', parseLyricsFromInput);

    // Playback Controls
    dom['play-pause-btn'].addEventListener('click', togglePlay);
    dom['sync-mode-btn'].addEventListener('click', startSync);
    dom['tap-btn'].addEventListener('click', handleTap);
    document.addEventListener('keydown', e => { if (state.isSyncing && e.code === 'Space') handleTap(); });

    dom['preview-btn'].addEventListener('click', () => {
        state.audio.currentTime = 0;
        state.audio.play();
        if (state.bgType === 'video') state.backgroundVideo.play();
        state.isPlaying = true;
    });

    dom['export-btn'].addEventListener('click', exportVideo);
}

function parseLyricsFromInput() {
    state.lyrics = dom['lyrics-input'].value.split('\n').filter(l => l.trim() !== '');
    // If not synced yet, init sync array
    if (state.syncedLyrics.length !== state.lyrics.length) {
        state.syncedLyrics = state.lyrics.map(text => ({ text, time: -1 }));
    }
}

function togglePlay() {
    if (state.isPlaying) {
        state.audio.pause();
        if (state.bgType === 'video') state.backgroundVideo.pause();
        state.isPlaying = false;
        dom['play-pause-btn'].innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
        state.audio.play();
        if (state.bgType === 'video') state.backgroundVideo.play();
        state.isPlaying = true;
        dom['play-pause-btn'].innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
}

// --- SYNC ENGINE ---
let syncIndex = 0;

function startSync() {
    if (!state.audio.src) return alert("Sube audio primero");
    if (state.lyrics.length === 0) return alert("Falta letra");

    state.isSyncing = true;
    syncIndex = 0;
    state.syncedLyrics.forEach(l => l.time = -1);

    dom['sync-overlay'].classList.remove('hidden');
    dom['sync-current-text'].textContent = "ESPERA...";

    state.audio.currentTime = 0;
    state.audio.play();
    state.isPlaying = true;

    // Countdown or just logic? Just Start.
    dom['sync-current-text'].textContent = "TAP al empezar la frase";
    dom['sync-next-text'].textContent = state.lyrics[0];
}

function handleTap() {
    if (!state.isSyncing) return;

    const t = state.audio.currentTime;

    if (syncIndex < state.syncedLyrics.length) {
        state.syncedLyrics[syncIndex].time = t;

        // UI Feedback
        dom['tap-btn'].style.transform = "scale(0.9)";
        setTimeout(() => dom['tap-btn'].style.transform = "scale(1)", 100);

        syncIndex++;

        if (syncIndex < state.syncedLyrics.length) {
            dom['sync-current-text'].textContent = state.syncedLyrics[syncIndex - 1].text;
            dom['sync-next-text'].textContent = state.syncedLyrics[syncIndex].text;
        } else {
            dom['sync-current-text'].textContent = "¡FIN!";
            setTimeout(endSync, 1500);
        }
    }
}

function endSync() {
    state.isSyncing = false;
    dom['sync-overlay'].classList.add('hidden');
    state.audio.pause();
    state.isPlaying = false;
    dom['status-msg'].textContent = "Sincronización guardada.";
}

// --- RENDER ENGINE ---

function loop() {
    requestAnimationFrame(loop);

    const now = state.audio.currentTime;

    // Update progress
    if (state.audio.duration) {
        dom['progress-fill'].style.width = (now / state.audio.duration * 100) + '%';
    }

    render(now);
}

function render(time) {
    const w = state.canvas.width;
    const h = state.canvas.height;
    const ctx = state.ctx;
    const cfg = state.config;

    // 1. CLEAR & BG
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Draw Media
    ctx.save();
    if (cfg.bg.scale !== 1) {
        ctx.translate(w / 2, h / 2);
        ctx.scale(cfg.bg.scale, cfg.bg.scale);
        ctx.translate(-w / 2, -h / 2);
    }

    if (state.bgType === 'image' && state.backgroundImage) {
        drawCover(ctx, state.backgroundImage, w, h);
    } else if (state.bgType === 'video') {
        // Sync video playback?
        // Only if exporting or previewing we want strict sync, 
        // but simple "play when audio plays" is usually enough for loop backgrounds.
        drawCover(ctx, state.backgroundVideo, w, h);
    }
    ctx.restore();

    // Filters (Blur / Darken)
    if (cfg.bg.blur > 0) {
        // Heavy Op? Maybe simplify. Canvas blur is slow. 
        // For video export it's fine, for realtime maybe lower quality?
        // Actually filter property is widely supported now.
        // But ctx.filter resets if we don't clear it.
        // Complicated with drawImage.
        // Alternative: Draw semi-transparent black for 'blur' simulation or just css?
        // No, we need it on canvas.
        // Let's use simple rect overlay for darken.
    }

    // Darken Overlay
    if (cfg.bg.darken > 0) {
        ctx.fillStyle = `rgba(0,0,0, ${cfg.bg.darken / 100})`;
        ctx.fillRect(0, 0, w, h);
    }

    // 2. VISUAL FX LAYERS
    if (cfg.fx.grain) drawGrain(ctx, w, h, time);
    if (cfg.fx.vignette) drawVignette(ctx, w, h);
    if (cfg.fx.particles) updateParticles(ctx, w, h, time);

    // 3. LYRICS
    drawLyrics(ctx, w, h, time);
}

function drawCover(ctx, img, w, h) {
    // Simulate object-fit: cover
    const imgRatio = (img.videoWidth || img.width) / (img.videoHeight || img.height);
    const cvsRatio = w / h;
    let dw, dh, dx, dy;

    if (imgRatio > cvsRatio) {
        dh = h;
        dw = h * imgRatio;
        dx = (w - dw) / 2;
        dy = 0;
    } else {
        dw = w;
        dh = w / imgRatio;
        dy = (h - dh) / 2;
        dx = 0;
    }

    // Apply blur filter if needed on the drawing context
    if (state.config.bg.blur > 0) {
        ctx.filter = `blur(${state.config.bg.blur}px)`;
    } else {
        ctx.filter = 'none';
    }

    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none'; // Reset
}

function drawLyrics(ctx, w, h, time) {
    const cfg = state.config.text;

    // Find Current Index
    let idx = -1;
    for (let i = 0; i < state.syncedLyrics.length; i++) {
        if (state.syncedLyrics[i].time <= time && state.syncedLyrics[i].time !== -1) idx = i;
        else if (state.syncedLyrics[i].time > time) break;
    }

    if (idx === -1) return;

    const line = state.syncedLyrics[idx];
    const durationSinceStart = time - line.time;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Font Setup
    let fontName = 'Outfit';
    if (cfg.style === 'serif') fontName = 'serif';
    if (cfg.style === 'arcade') fontName = 'Courier New';
    ctx.font = `800 ${cfg.size * 2}px "${fontName}"`; // *2 because canvas is 1080p

    // Animation Logic
    let alpha = 1;
    let yOff = 0;
    let scale = 1;

    const animDur = 0.5; // seconds
    if (durationSinceStart < animDur) {
        const p = durationSinceStart / animDur; // 0 to 1
        // Ease out quad
        const ease = p * (2 - p);

        switch (cfg.animation) {
            case 'fade': alpha = ease; break;
            case 'slide-up': alpha = ease; yOff = 100 * (1 - ease); break;
            case 'zoom-in': scale = 0.5 + (0.5 * ease); alpha = ease; break;
            case 'typewriter':
                // Handled in text drawing string slice
                break;
        }
    }

    // Set Colors
    ctx.fillStyle = cfg.color;
    // Neon glow
    if (cfg.style === 'neon') {
        ctx.shadowColor = cfg.accent;
        ctx.shadowBlur = 40;
    } else if (cfg.style === 'bold') {
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'black';
        ctx.strokeText(line.text, w / 2, h / 2 + yOff);
    } else if (cfg.style === 'arcade') {
        ctx.shadowColor = cfg.shadow;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.shadowBlur = 0;
    } else {
        ctx.shadowBlur = 0;
    }

    // Transform
    ctx.save();
    ctx.translate(w / 2, h / 2 + yOff);
    ctx.scale(scale, scale);

    ctx.globalAlpha = alpha;

    let textToDraw = line.text;
    if (cfg.animation === 'typewriter' && durationSinceStart < 1.5) {
        const len = Math.floor(line.text.length * (durationSinceStart / 1.5));
        textToDraw = line.text.substring(0, len);
    }

    ctx.fillText(textToDraw, 0, 0);
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

// --- FX ---

function drawVignette(ctx, w, h) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, w / 3, w / 2, h / 2, w);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
}

function drawGrain(ctx, w, h, time) {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    // Fast noise approximation: actually drawing noise image is better.
    // For procedure: draw random dots
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 100; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
}

function updateParticles(ctx, w, h, time) {
    if (state.particles.length < 50) {
        state.particles.push({
            x: Math.random() * w,
            y: h + 10,
            v: 1 + Math.random() * 3,
            s: 1 + Math.random() * 4
        });
    }

    ctx.fillStyle = state.config.text.accent;
    state.particles.forEach(p => {
        p.y -= p.v;
        if (p.y < -10) p.y = h + 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
    });
}

// --- EXPORT ---

function exportVideo() {
    if (!state.audio.src) return alert("Nada que exportar");

    dom['status-msg'].textContent = "Iniciando grabación...";
    state.audio.pause();
    state.audio.currentTime = 0;
    if (state.bgType === 'video') state.backgroundVideo.currentTime = 0;

    const stream = state.canvas.captureStream(30);

    // Audio Mix
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = actx.createMediaStreamDestination();
    const source = actx.createMediaElementSource(state.audio);
    source.connect(dest);
    source.connect(actx.destination);

    stream.addTrack(dest.stream.getAudioTracks()[0]);

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks = [];

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video-lyric-pro.webm`;
        a.click();
        dom['status-msg'].textContent = "¡Exportación Exitosa!";
    };

    mediaRecorder.start();
    state.audio.play();
    if (state.bgType === 'video') state.backgroundVideo.play();
    state.audio.onended = () => mediaRecorder.stop();
}

// Start
init();
