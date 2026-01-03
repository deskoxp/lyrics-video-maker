/**
 * LyricFlow PRO - Video Engine v2.5
 * - Separate Particle Color
 * - Metadata & Watermark
 * - Improved Layout Logic
 */

const state = {
    // Media
    audio: new Audio(),
    backgroundVideo: document.createElement('video'),
    backgroundImage: null,
    bgType: 'none',

    watermarkImage: null, // New

    // Data
    lyrics: [],
    translation: [],
    syncedLyrics: [],

    // Playback
    isPlaying: false,
    isSyncing: false,

    // Settings
    config: {
        bg: { blur: 0, darken: 50, scale: 1 },
        text: {
            style: 'neon',
            animation: 'slide-up',
            color: '#ffffff',
            accent: '#00f3ff',
            width: 85, // Max width percentage
            shadow: '#bc13fe',
            particleColor: '#ffe400', // New
            size: 50
        },
        meta: { artist: '', song: '' }, // New
        watermark: { opacity: 0.8 }, // New
        fx: { particles: true, vignette: true, grain: false }
    },

    // Rendering
    canvas: null,
    ctx: null,
    particles: [],

    // Recorder
    mediaRecorder: null,
    recordedChunks: []
};

const dom = {};

function init() {
    const ids = [
        'audio-upload', 'file-name', 'bg-upload', 'bg-file-name',
        'track-search', 'search-btn', 'lyrics-input', 'lyrics-translation',
        'bg-blur', 'bg-darken', 'bg-scale',
        'val-blur', 'val-darken', 'val-scale',
        'fx-particles', 'fx-vignette', 'fx-grain',
        'text-animation', 'text-color', 'accent-color', 'shadow-color', 'particle-color', 'font-size',
        'meta-artist', 'meta-song', 'watermark-upload', 'wm-file-name', 'wm-opacity',
        'sync-mode-btn', 'preview-btn', 'export-btn', 'play-pause-btn', 'status-msg',
        'video-canvas', 'sync-overlay', 'tap-btn',
        'sync-current-text', 'sync-next-text', 'progress-fill'
    ];
    ids.forEach(id => dom[id] = document.getElementById(id));

    setupTabs();
    setupStyleSelectors();

    state.canvas = dom['video-canvas'];
    state.ctx = state.canvas.getContext('2d');

    state.backgroundVideo.loop = true;
    state.backgroundVideo.muted = true;
    state.backgroundVideo.crossOrigin = "anonymous";
    state.backgroundVideo.playsInline = true;

    setupEvents();
    requestAnimationFrame(loop);
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}

function setupStyleSelectors() {
    document.querySelectorAll('.style-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.style-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            state.config.text.style = opt.dataset.style;
        });
    });
}

function setupEvents() {
    // Audio
    dom['audio-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        state.audio.src = URL.createObjectURL(file);
        dom['file-name'].textContent = file.name;
        dom['status-msg'].textContent = "Audio cargado.";
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
            state.backgroundVideo.play().catch(e => console.log(e));
        } else {
            const img = new Image();
            img.src = url;
            state.backgroundImage = img;
            state.bgType = 'image';
        }
    });

    // Watermark Input
    dom['watermark-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        dom['wm-file-name'].textContent = file.name;
        const img = new Image();
        img.src = url;
        state.watermarkImage = img;
    });

    // Configuration Inputs
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
        state.config.text.particleColor = dom['particle-color'].value;
        state.config.text.size = parseInt(dom['font-size'].value);

        state.config.meta.artist = dom['meta-artist'].value;
        state.config.meta.song = dom['meta-song'].value;
        state.config.watermark.opacity = parseInt(dom['wm-opacity'].value) / 100;

        state.config.fx.particles = dom['fx-particles'].checked;
        state.config.fx.vignette = dom['fx-vignette'].checked;
        state.config.fx.grain = dom['fx-grain'].checked;
    };

    // Bind generic inputs
    ['bg-blur', 'bg-darken', 'bg-scale', 'text-animation', 'text-color', 'accent-color', 'shadow-color', 'particle-color', 'font-size', 'meta-artist', 'meta-song', 'wm-opacity']
        .forEach(id => dom[id].addEventListener('input', updateConfig));
    ['fx-particles', 'fx-vignette', 'fx-grain']
        .forEach(id => dom[id].addEventListener('change', updateConfig));

    // Lyrics Search
    dom['search-btn'].addEventListener('click', async () => {
        const query = dom['track-search'].value;
        if (!query) return;

        // Auto-fill meta
        if (query.includes('-')) {
            const [artist, song] = query.split('-').map(s => s.trim());
            dom['meta-artist'].value = artist;
            dom['meta-song'].value = song;
            updateConfig();
        }

        const [artist, title] = query.split('-').map(s => s.trim());
        if (!artist) { dom['status-msg'].textContent = "Formato: Artista - Canción"; return; }

        dom['status-msg'].textContent = "Buscando letra...";
        try {
            const res = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
            const data = await res.json();
            if (data.lyrics) {
                dom['lyrics-input'].value = data.lyrics;
                parseAllLyrics();
                dom['status-msg'].textContent = "Letra cargada.";
            } else {
                dom['status-msg'].textContent = "Letra no encontrada.";
            }
        } catch (e) { console.error(e); }
    });

    // Inputs for Lyrics
    dom['lyrics-input'].addEventListener('input', parseAllLyrics);
    dom['lyrics-translation'].addEventListener('input', parseAllLyrics);

    // Playback
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

function parseAllLyrics() {
    state.lyrics = dom['lyrics-input'].value.split('\n').filter(l => l.trim() !== '');
    state.translation = dom['lyrics-translation'].value.split('\n').filter(l => l.trim() !== '');

    const count = state.lyrics.length;
    // Resize syncedLyrics if necessary
    if (state.syncedLyrics.length !== count) {
        const oldSync = state.syncedLyrics;
        state.syncedLyrics = new Array(count).fill(0).map((_, i) => ({
            text: state.lyrics[i],
            trans: state.translation[i] || '',
            time: oldSync[i] ? oldSync[i].time : -1
        }));
    } else {
        state.syncedLyrics.forEach((item, i) => {
            item.text = state.lyrics[i];
            item.trans = state.translation[i] || '';
        });
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
    if (state.lyrics.length === 0) return alert("Falta letra original");

    state.isSyncing = true;
    syncIndex = 0;
    state.syncedLyrics.forEach(l => l.time = -1);

    dom['sync-overlay'].classList.remove('hidden');
    dom['sync-current-text'].textContent = "ESPERA...";

    state.audio.currentTime = 0;
    state.audio.play();
    state.isPlaying = true;

    dom['sync-current-text'].textContent = "TAP al empezar la frase";
    dom['sync-next-text'].textContent = state.lyrics[0];
}

function handleTap() {
    if (!state.isSyncing) return;
    const t = state.audio.currentTime;

    if (syncIndex < state.syncedLyrics.length) {
        state.syncedLyrics[syncIndex].time = t;

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

    // 1. BG
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (cfg.bg.scale !== 1) {
        ctx.translate(w / 2, h / 2);
        ctx.scale(cfg.bg.scale, cfg.bg.scale);
        ctx.translate(-w / 2, -h / 2);
    }

    if (state.bgType === 'image' && state.backgroundImage) {
        drawCover(ctx, state.backgroundImage, w, h);
    } else if (state.bgType === 'video') {
        drawCover(ctx, state.backgroundVideo, w, h);
    }
    ctx.restore();

    // Background Darken
    if (cfg.bg.darken > 0) {
        ctx.fillStyle = `rgba(0,0,0, ${cfg.bg.darken / 100})`;
        ctx.fillRect(0, 0, w, h);
    }

    // 2. FX
    if (cfg.fx.grain) drawGrain(ctx, w, h);
    if (cfg.fx.vignette) drawVignette(ctx, w, h);

    // Particles (now separate color)
    if (cfg.fx.particles) updateParticles(ctx, w, h);

    // 3. TEXT & METADATA
    drawLyricsBlock(ctx, w, h, time);
    drawMetadata(ctx, w, h);

    // 4. WATERMARK
    if (state.watermarkImage) drawWatermark(ctx, w, h);
}

function drawCover(ctx, img, w, h) {
    const imgRatio = (img.videoWidth || img.width) / (img.videoHeight || img.height);
    const cvsRatio = w / h;
    let dw, dh, dx, dy;

    if (imgRatio > cvsRatio) {
        dh = h; dw = h * imgRatio; dx = (w - dw) / 2; dy = 0;
    } else {
        dw = w; dh = w / imgRatio; dy = (h - dh) / 2; dx = 0;
    }

    if (state.config.bg.blur > 0) ctx.filter = `blur(${state.config.bg.blur}px)`;
    else ctx.filter = 'none';

    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
}

function getLines(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function drawLyricsBlock(ctx, w, h, time) {
    const cfg = state.config.text;

    // Active Lyric Logic
    let idx = -1;
    for (let i = 0; i < state.syncedLyrics.length; i++) {
        if (state.syncedLyrics[i].time <= time && state.syncedLyrics[i].time !== -1) idx = i;
        else if (state.syncedLyrics[i].time > time) break;
    }

    if (idx === -1) return;

    const lineObj = state.syncedLyrics[idx];
    const duration = time - lineObj.time;

    // Font Setup
    let fontName = 'Outfit';
    if (cfg.style === 'serif') fontName = 'serif';
    if (cfg.style === 'arcade') fontName = 'Courier New';

    const fontSizeMain = cfg.size * 2;
    const fontSizeTrans = fontSizeMain * 0.6;
    const maxWidth = w * 0.85;

    // Calcs
    ctx.font = `800 ${fontSizeMain}px "${fontName}"`;
    const mainLines = getLines(ctx, lineObj.text, maxWidth);

    let transLines = [];
    if (lineObj.trans) {
        ctx.font = `italic 500 ${fontSizeTrans}px "${fontName}"`;
        // Ensure translation also respects max width
        transLines = getLines(ctx, lineObj.trans, maxWidth);
    }

    const lineHeightMain = fontSizeMain * 1.25;
    const lineHeightTrans = fontSizeTrans * 1.4;
    const gap = 40;

    // Calculate total height of the text block to center it
    const totalHeight = (mainLines.length * lineHeightMain) +
        (transLines.length > 0 ? (gap + (transLines.length * lineHeightTrans) - lineHeightTrans) : 0);
    // Note: subtracted one lineHeightTrans because the loop usually adds Y AFTER text, or we can just simplify logic.
    // Let's standardise: draw at Y. Next line at Y + height.
    // So total height is roughly sum of all line heights.

    const realTotalHeight = (mainLines.length * lineHeightMain) +
        (transLines.length > 0 ? gap + (transLines.length * lineHeightTrans) : 0);

    let startY = (h / 2) - (realTotalHeight / 2) + (lineHeightMain * 0.7); // Adjustment for baseline

    // Animation
    let alpha = 1;
    let yAnim = 0;
    let scale = 1;

    const animDur = 0.5;
    if (duration < animDur) {
        const p = duration / animDur;
        const ease = p * (2 - p);
        if (cfg.animation === 'fade') alpha = ease;
        if (cfg.animation === 'slide-up') { alpha = ease; yAnim = 80 * (1 - ease); }
        if (cfg.animation === 'zoom-in') { scale = 0.8 + (0.2 * ease); alpha = ease; }
    }

    // Draw
    ctx.save();
    ctx.translate(w / 2, startY + yAnim);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    // Main Text
    ctx.font = `800 ${fontSizeMain}px "${fontName}"`;
    if (cfg.style === 'neon') {
        ctx.shadowColor = cfg.shadow; ctx.shadowBlur = 40; ctx.fillStyle = cfg.color;
    } else if (cfg.style === 'bold') {
        ctx.shadowBlur = 0; ctx.strokeStyle = 'black'; ctx.lineWidth = 6;
        ctx.fillStyle = cfg.color;
    } else {
        ctx.fillStyle = cfg.color; ctx.shadowBlur = 0;
    }

    mainLines.forEach((t, i) => {
        if (cfg.style === 'bold') ctx.strokeText(t, 0, i * lineHeightMain);
        ctx.fillText(t, 0, i * lineHeightMain);
    });

    // Translation
    if (transLines.length > 0) {
        // Start drawing translation AFTER all main lines
        const transStartY = (mainLines.length * lineHeightMain) + gap;

        ctx.font = `italic 500 ${fontSizeTrans}px "${fontName}"`;
        ctx.fillStyle = cfg.accent; // Translation uses Accent color
        ctx.shadowBlur = 0; // No glow for translation usually
        if (cfg.style === 'bold') ctx.strokeStyle = 'rgba(0,0,0,0.5)';

        transLines.forEach((t, i) => {
            const ly = transStartY + (i * lineHeightTrans);
            if (cfg.style === 'bold') { ctx.lineWidth = 3; ctx.strokeText(t, 0, ly); }
            ctx.fillText(t, 0, ly);
        });
    }

    ctx.restore();
}

function drawMetadata(ctx, w, h) {
    if (!state.config.meta.artist && !state.config.meta.song) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 0;

    const yPos = h - 150;

    if (state.config.meta.song) {
        ctx.font = '700 40px "Outfit"';
        ctx.fillText(state.config.meta.song, w / 2, yPos);
    }

    if (state.config.meta.artist) {
        ctx.font = '400 30px "Outfit"';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(state.config.meta.artist, w / 2, yPos + 45);
    }
    ctx.restore();
}

function drawWatermark(ctx, w, h) {
    if (!state.watermarkImage) return;

    ctx.save();
    ctx.globalAlpha = state.config.watermark.opacity;

    // Resize logic: keep small, e.g. 15% of width
    const targetW = w * 0.2;
    const imgRatio = state.watermarkImage.width / state.watermarkImage.height;
    const targetH = targetW / imgRatio;

    // Position: Top Right with padding
    const padding = 50;
    const x = w - targetW - padding;
    const y = padding;

    ctx.drawImage(state.watermarkImage, x, y, targetW, targetH);
    ctx.restore();
}

function drawVignette(ctx, w, h) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.4, w / 2, h / 2, w);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
}

function drawGrain(ctx, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 150; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
}

function updateParticles(ctx, w, h) {
    if (state.particles.length < 50) {
        state.particles.push({
            x: Math.random() * w, y: h + 10,
            v: 1 + Math.random() * 3, s: 1 + Math.random() * 4
        });
    }

    // USE NEW PARTICLE COLOR
    ctx.fillStyle = state.config.text.particleColor;

    ctx.globalAlpha = 0.5;
    state.particles.forEach(p => {
        p.y -= p.v;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function exportVideo() {
    if (!state.audio.src) return alert("Nada que exportar");

    dom['status-msg'].textContent = "Iniciando grabación... NO CAMBIES DE PESTAÑA";
    state.audio.pause();
    state.audio.currentTime = 0;
    if (state.bgType === 'video') state.backgroundVideo.currentTime = 0;

    const stream = state.canvas.captureStream(30);
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
        const title = state.config.meta.song ? state.config.meta.song.replace(/\s+/g, '-') : 'lyric-video';
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.webm`;
        a.click();
        dom['status-msg'].textContent = "¡Video Exportado!";
    };

    mediaRecorder.start();
    state.audio.play();
    if (state.bgType === 'video') state.backgroundVideo.play();
    state.audio.onended = () => mediaRecorder.stop();
}

init();
