/**
 * LyricFlow PRO - Video Engine v3.5 (Cleaned & Optimized)
 * - Fixed Duplicate Functions
 * - Restored LRC & Effect Markers (***, %%%, ###)
 * - Fixed MP3 Upload
 * - MP4 Export Support
 */

const state = {
    audio: new Audio(),
    audioContext: null,
    analyser: null,
    dataArray: null,
    sourceNode: null,

    backgroundVideo: document.createElement('video'),
    backgroundImage: null,
    bgType: 'none',
    watermarkImage: null,

    lyrics: [],
    translation: [],
    syncedLyrics: [],

    isPlaying: false,
    isSyncing: false,

    config: {
        bg: { blur: 0, darken: 50, scale: 1, reactive: false, intensity: 50 },
        text: {
            style: 'neon',
            animation: 'slide-up',
            color: '#ffffff',
            accent: '#00f3ff',
            particleColor: '#ffe400',
            particleTheme: 'standard',
            particleSize: 1.0,
            width: 85,
            shadow: '#bc13fe',
            size: 50,
            transFont: 'inherit',
            transSizePct: 0.6,
            particleSpeed: 1.0
        },
        viz: { style: 'none', color: '#ffffff' },
        meta: { artist: '', song: '' },
        watermark: { opacity: 0.8 },
        fx: { particles: true, vignette: true, grain: false }
    },

    canvas: null,
    ctx: null,
    particles: [],

    recordedChunks: [],
    popup: { window: null, canvas: null, ctx: null }
};

const dom = {};

function init() {
    const ids = [
        'audio-upload', 'file-name', 'bg-upload', 'bg-file-name',
        'track-search', 'search-btn', 'lyrics-input', 'lyrics-translation',
        'bg-blur', 'bg-darken', 'bg-scale', 'audio-reactive-bg', 'beat-intensity',
        'val-blur', 'val-darken', 'val-scale',
        'fx-particles', 'fx-vignette', 'fx-grain',
        'text-animation', 'text-color', 'accent-color', 'shadow-color', 'particle-color', 'particle-theme', 'particle-size', 'particle-speed', 'font-size',
        'trans-font', 'trans-size', 'val-trans-size', 'val-part-size', 'val-part-speed',
        'viz-style', 'viz-color',
        'meta-artist', 'meta-song', 'watermark-upload', 'wm-file-name', 'wm-opacity',
        'sync-mode-btn', 'preview-btn', 'popup-btn', 'export-btn', 'play-pause-btn', 'status-msg',
        'video-canvas', 'sync-overlay', 'tap-btn', 'stop-sync-btn', 'timeline-editor',
        'sync-current-text', 'sync-next-text', 'progress-fill', 'volume-slider',
        'export-start', 'export-end', 'set-start-btn', 'set-end-btn'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) dom[id] = el;
    });

    state.canvas = dom['video-canvas'];
    state.ctx = state.canvas.getContext('2d');

    state.audio.crossOrigin = "anonymous";
    state.backgroundVideo.loop = true;
    state.backgroundVideo.muted = true;
    state.backgroundVideo.crossOrigin = "anonymous";
    state.backgroundVideo.playsInline = true;

    setupTabs();
    setupStyleSelectors();
    setupEvents();
    requestAnimationFrame(loop);
}

function initAudioContext() {
    if (state.audioContext) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContext();
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    state.dataArray = new Uint8Array(state.analyser.frequencyBinCount);

    state.sourceNode = state.audioContext.createMediaElementSource(state.audio);
    state.sourceNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);
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
    dom['audio-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        state.audio.src = URL.createObjectURL(file);
        dom['file-name'].textContent = file.name;
        dom['status-msg'].textContent = "Audio cargado.";
    });

    dom['bg-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        dom['bg-file-name'].textContent = file.name;
        if (file.type.startsWith('video')) {
            state.backgroundVideo.src = url;
            state.bgType = 'video';
            state.backgroundImage = null;
            state.backgroundVideo.play().catch(err => console.log(err));
        } else {
            const img = new Image();
            img.src = url;
            state.backgroundImage = img;
            state.bgType = 'image';
        }
    });

    dom['watermark-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const img = new Image();
        img.src = URL.createObjectURL(file);
        dom['wm-file-name'].textContent = file.name;
        state.watermarkImage = img;
    });

    const updateConfig = () => {
        state.config.bg.blur = parseInt(dom['bg-blur'].value);
        state.config.bg.darken = parseInt(dom['bg-darken'].value);
        state.config.bg.scale = parseInt(dom['bg-scale'].value) / 100;
        state.config.bg.reactive = dom['audio-reactive-bg'].checked;
        state.config.bg.intensity = parseInt(dom['beat-intensity'].value);

        dom['val-blur'].innerText = state.config.bg.blur + 'px';
        dom['val-darken'].innerText = state.config.bg.darken + '%';
        dom['val-scale'].innerText = Math.round(state.config.bg.scale * 100) + '%';

        state.config.text.animation = dom['text-animation'].value;
        state.config.text.color = dom['text-color'].value;
        state.config.text.accent = dom['accent-color'].value;
        state.config.text.shadow = dom['shadow-color'].value;
        state.config.text.particleColor = dom['particle-color'].value;

        const newTheme = dom['particle-theme'].value;
        if (state.config.text.particleTheme !== newTheme) {
            state.particles = [];
            state.config.text.particleTheme = newTheme;
        }

        state.config.text.particleSize = parseInt(dom['particle-size'].value) / 100;
        dom['val-part-size'].innerText = dom['particle-size'].value + '%';

        state.config.text.particleSpeed = parseInt(dom['particle-speed'].value) / 100;
        dom['val-part-speed'].innerText = dom['particle-speed'].value + '%';

        state.config.text.size = parseInt(dom['font-size'].value);
        state.config.text.transFont = dom['trans-font'].value;
        state.config.text.transSizePct = parseInt(dom['trans-size'].value) / 100;
        dom['val-trans-size'].innerText = dom['trans-size'].value + '%';

        state.config.viz.style = dom['viz-style'].value;
        state.config.viz.color = dom['viz-color'].value;

        state.config.meta.artist = dom['meta-artist'].value;
        state.config.meta.song = dom['meta-song'].value;
        state.config.watermark.opacity = parseInt(dom['wm-opacity'].value) / 100;

        state.config.fx.particles = dom['fx-particles'].checked;
        state.config.fx.vignette = dom['fx-vignette'].checked;
        state.config.fx.grain = dom['fx-grain'].checked;
    };

    const inputs = ['bg-blur', 'bg-darken', 'bg-scale', 'beat-intensity', 'text-animation',
        'text-color', 'accent-color', 'shadow-color', 'particle-color', 'particle-theme', 'particle-size', 'particle-speed',
        'font-size', 'meta-artist', 'meta-song', 'wm-opacity', 'trans-font',
        'trans-size', 'viz-style', 'viz-color'];
    inputs.forEach(id => { if (dom[id]) dom[id].addEventListener('input', updateConfig); });
    ['fx-particles', 'fx-vignette', 'fx-grain', 'audio-reactive-bg'].forEach(id => {
        if (dom[id]) dom[id].addEventListener('change', updateConfig);
    });

    dom['search-btn'].addEventListener('click', async () => {
        const query = dom['track-search'].value;
        if (!query || !query.includes('-')) return;
        const [artist, title] = query.split('-').map(s => s.trim());
        dom['meta-artist'].value = artist;
        dom['meta-song'].value = title;
        updateConfig();
        dom['status-msg'].textContent = "Buscando letra...";
        try {
            const res = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
            const data = await res.json();
            if (data.lyrics) {
                dom['lyrics-input'].value = data.lyrics;
                parseAllLyrics();
                dom['status-msg'].textContent = "Letra cargada.";
            } else dom['status-msg'].textContent = "Letra no encontrada.";
        } catch (e) { dom['status-msg'].textContent = "Error al buscar."; }
    });

    dom['lyrics-input'].addEventListener('input', parseAllLyrics);
    dom['lyrics-translation'].addEventListener('input', parseAllLyrics);
    dom['play-pause-btn'].addEventListener('click', togglePlay);
    dom['sync-mode-btn'].addEventListener('click', startSync);
    dom['stop-sync-btn'].addEventListener('click', endSync);
    dom['tap-btn'].addEventListener('click', handleTap);
    document.addEventListener('keydown', e => { if (state.isSyncing && e.code === 'Space') handleTap(); });

    dom['preview-btn'].addEventListener('click', () => {
        initAudioContext();
        state.audio.currentTime = 0;
        state.audio.play();
        if (state.bgType === 'video') state.backgroundVideo.play();
        state.isPlaying = true;
    });

    dom['popup-btn']?.addEventListener('click', openOBSPopup);

    dom['export-btn'].addEventListener('click', exportVideo);

    dom['volume-slider'].addEventListener('input', (e) => {
        state.audio.volume = parseFloat(e.target.value);
    });

    dom['set-start-btn'].addEventListener('click', () => {
        dom['export-start'].value = state.audio.currentTime.toFixed(1);
    });

    dom['set-end-btn'].addEventListener('click', () => {
        dom['export-end'].value = state.audio.currentTime.toFixed(1);
    });
}

function openOBSPopup() {
    const w = 1080;
    const h = 1920;
    const popup = window.open('', 'LyricFlowOBS', `width=${w / 2},height=${h / 2},menubar=no,toolbar=no,location=no,status=no`);

    if (!popup) return alert("Por favor, permite las ventanas emergentes.");

    popup.document.body.innerHTML = `
        <style>
            body { margin: 0; background: black; overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100vh; }
            canvas { max-width: 100%; max-height: 100%; object-fit: contain; background: #000; }
        </style>
        <canvas id="obs-canvas" width="${w}" height="${h}"></canvas>
    `;
    popup.document.title = "OBS Preview - LyricFlow Pro";

    state.popup.window = popup;
    state.popup.canvas = popup.document.getElementById('obs-canvas');
    state.popup.ctx = state.popup.canvas.getContext('2d');

    popup.onbeforeunload = () => {
        state.popup.window = null;
        state.popup.canvas = null;
        state.popup.ctx = null;
    };
}

function parseAllLyrics() {
    const rawLines = dom['lyrics-input'].value.split('\n').filter(l => l.trim() !== '');
    state.translation = dom['lyrics-translation'].value.split('\n').filter(l => l.trim() !== '');

    const cleanLyrics = [];
    const parsedTimes = [];
    const parsedEffects = [];
    const timeRegex = /^\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;

    rawLines.forEach(line => {
        let text = line.trim();
        let time = null;
        const match = text.match(timeRegex);
        if (match) {
            time = parseFloat(match[1]) * 60 + parseFloat(match[2]);
            text = match[3].trim();
        }

        let effect = 'none';
        if (text.startsWith('***') && text.endsWith('***')) { effect = 'pulse'; text = text.slice(3, -3).trim(); }
        else if (text.startsWith('%%%') && text.endsWith('%%%')) { effect = 'glitch'; text = text.slice(3, -3).trim(); }
        else if (text.startsWith('###') && text.endsWith('###')) { effect = 'flash'; text = text.slice(3, -3).trim(); }

        cleanLyrics.push(text);
        parsedEffects.push(effect);
        parsedTimes.push(time);
    });

    state.lyrics = cleanLyrics;
    const oldSync = state.syncedLyrics;
    state.syncedLyrics = cleanLyrics.map((text, i) => {
        let time = (parsedTimes[i] !== null) ? parsedTimes[i] : (oldSync[i] ? oldSync[i].time : -1);
        return { text, trans: state.translation[i] || '', time, effect: parsedEffects[i] };
    });

    if (dom['timeline-editor'].classList.contains('active')) renderTimelineEditor();
}

function togglePlay() {
    initAudioContext();
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

let syncIndex = 0;
function startSync() {
    if (!state.audio.src) return alert("Sube audio primero");
    initAudioContext();
    state.isSyncing = true;
    syncIndex = 0;
    state.syncedLyrics.forEach(l => l.time = -1);
    dom['sync-overlay'].classList.remove('hidden');
    state.audio.currentTime = 0;
    state.audio.play();
    state.isPlaying = true;
    updateSyncUI();
}

function updateSyncUI() {
    if (syncIndex < state.syncedLyrics.length) {
        dom['sync-current-text'].textContent = syncIndex > 0 ? state.syncedLyrics[syncIndex - 1].text : "TAP para empezar";
        dom['sync-next-text'].textContent = state.syncedLyrics[syncIndex].text;
    } else {
        dom['sync-current-text'].textContent = "¡FIN!";
        setTimeout(endSync, 1000);
    }
}

function handleTap() {
    if (!state.isSyncing) return;
    const t = state.audio.currentTime;
    if (syncIndex < state.syncedLyrics.length) {
        state.syncedLyrics[syncIndex].time = t;
        syncIndex++;
        updateSyncUI();
    }
}

function endSync() {
    state.isSyncing = false;
    dom['sync-overlay'].classList.add('hidden');
    state.audio.pause();
    state.isPlaying = false;
    dom['play-pause-btn'].innerHTML = '<i class="fa-solid fa-play"></i>';
    renderTimelineEditor();
}

function renderTimelineEditor() {
    const container = dom['timeline-editor'];
    container.innerHTML = '';
    container.classList.add('active');
    state.syncedLyrics.forEach((line, index) => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        const timeInput = document.createElement('input');
        timeInput.type = 'number'; timeInput.step = '0.1'; timeInput.className = 'time-input';
        timeInput.value = line.time === -1 ? 0 : line.time.toFixed(2);
        timeInput.addEventListener('change', (e) => state.syncedLyrics[index].time = parseFloat(e.target.value));
        const textSpan = document.createElement('span');
        textSpan.className = 'lyric-preview'; textSpan.textContent = line.text;
        row.appendChild(timeInput); row.appendChild(textSpan);
        container.appendChild(row);
    });
}

function loop() {
    requestAnimationFrame(loop);
    let avgVol = 0;
    if (state.analyser) {
        state.analyser.getByteFrequencyData(state.dataArray);
        let sum = 0;
        for (let i = 0; i < 20; i++) sum += state.dataArray[i];
        avgVol = sum / 20;
    }
    const now = state.audio.currentTime;
    if (state.audio.duration) {
        dom['progress-fill'].style.width = (now / state.audio.duration * 100) + '%';
        const mins = Math.floor(now / 60);
        const secs = Math.floor(now % 60);
        document.querySelector('.time-code').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    render(now, avgVol);
}

function render(time, avgVol) {
    const { width: w, height: h } = state.canvas;
    const ctx = state.ctx;
    const cfg = state.config;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    let scale = cfg.bg.scale;
    if (cfg.bg.reactive) scale += (avgVol / 255) * (cfg.bg.intensity / 100) * 0.2;

    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2);
    if (state.bgType === 'image' && state.backgroundImage) drawCover(ctx, state.backgroundImage, w, h);
    else if (state.bgType === 'video') drawCover(ctx, state.backgroundVideo, w, h);
    ctx.restore();

    if (cfg.bg.darken > 0) { ctx.fillStyle = `rgba(0,0,0, ${cfg.bg.darken / 100})`; ctx.fillRect(0, 0, w, h); }
    if (cfg.fx.grain) drawGrain(ctx, w, h);
    if (cfg.fx.vignette) drawVignette(ctx, w, h);
    if (cfg.viz.style !== 'none') drawVisualizer(ctx, w, h, avgVol);
    if (cfg.fx.particles) updateParticles(ctx, w, h, avgVol);
    drawLyricsBlock(ctx, w, h, time, avgVol);
    drawMetadata(ctx, w, h);
    if (state.watermarkImage) drawWatermark(ctx, w, h);

    // Copy to OBS Popup if open
    if (state.popup.ctx) {
        state.popup.ctx.drawImage(state.canvas, 0, 0);
    }
}

function drawLyricsBlock(ctx, w, h, time, avgVol) {
    let idx = -1;
    for (let i = 0; i < state.syncedLyrics.length; i++) {
        if (state.syncedLyrics[i].time <= time && state.syncedLyrics[i].time !== -1) idx = i;
        else if (state.syncedLyrics[i].time > time) break;
    }
    if (idx === -1) return;

    const lineObj = state.syncedLyrics[idx];
    const duration = time - lineObj.time;
    const cfg = state.config.text;

    const fontName = cfg.style === 'serif' ? 'serif' : (cfg.style === 'arcade' ? 'Courier New' : 'Outfit');
    const fontSizeMain = cfg.size * 2;

    // --- TIKTOK SAFE ZONE (SIMÉTRICA) ---
    // Usamos un ancho máximo del 70% (maxWidth = w * 0.7).
    // Esto deja un margen del 15% (162px) a CADA lado.
    // Mantiene el centrado perfecto y evita los botones de TikTok.
    const maxWidth = w * 0.7;
    const centerX = w / 2;

    ctx.font = `800 ${fontSizeMain}px "${fontName}"`;
    const mainLines = getLines(ctx, lineObj.text, maxWidth);
    const lineHeightMain = fontSizeMain * 1.25;

    let transLines = [], fontSizeTrans = fontSizeMain * (cfg.transSizePct || 0.6);
    if (lineObj.trans) {
        ctx.font = `italic 500 ${fontSizeTrans}px "${cfg.transFont === 'inherit' ? fontName : cfg.transFont}"`;
        transLines = getLines(ctx, lineObj.trans, maxWidth);
    }
    const lineHeightTrans = fontSizeTrans * 1.4, gap = 40;
    const totalH = (mainLines.length * lineHeightMain) + (transLines.length > 0 ? gap + (transLines.length * lineHeightTrans) : 0);
    let startY = (h / 2) - (totalH / 2) + (lineHeightMain * 0.7);

    let alpha = 1, yAnim = 0, scale = 1, animDur = 0.5;
    if (cfg.animation === 'typewriter') { /* handled per char */ }
    else if (duration < animDur) {
        const p = duration / animDur, ease = p * (2 - p);
        if (cfg.animation === 'fade') alpha = ease;
        else if (cfg.animation === 'slide-up') { alpha = ease; yAnim = 80 * (1 - ease); }
        else if (cfg.animation === 'zoom-in') { scale = 0.8 + (0.2 * ease); alpha = ease; }
    }

    ctx.save();
    let shakeX = 0, shakeY = 0;
    if (lineObj.effect === 'pulse') {
        scale *= 0.5; // Achicar base al 50%
        scale += (avgVol / 255) * 0.5; // Pulse de 50%
    }
    else if (lineObj.effect === 'glitch') { shakeX = (Math.random() - 0.5) * 20; shakeY = (Math.random() - 0.5) * 5; if (Math.random() > 0.8) ctx.globalCompositeOperation = 'exclusion'; }
    else if (lineObj.effect === 'flash' && Math.floor(Date.now() / 50) % 2 === 0) { ctx.fillStyle = '#fff'; ctx.shadowBlur = 100; ctx.shadowColor = '#fff'; }

    ctx.translate(centerX + shakeX, startY + yAnim + shakeY); ctx.scale(scale, scale); ctx.globalAlpha = alpha; ctx.textAlign = 'center';
    ctx.font = `800 ${fontSizeMain}px "${fontName}"`;

    if (lineObj.effect !== 'flash') {
        if (cfg.style === 'neon') { ctx.shadowColor = cfg.shadow; ctx.shadowBlur = 40; ctx.fillStyle = cfg.color; }
        else if (cfg.style === 'bold') { ctx.strokeStyle = 'black'; ctx.lineWidth = 6; ctx.strokeText(mainLines.join(' '), 0, 0); ctx.fillStyle = cfg.color; }
        else ctx.fillStyle = cfg.color;
    }

    const charLimit = cfg.animation === 'typewriter' ? Math.floor(duration / 0.05) : 9999;
    let charsUsed = 0;
    mainLines.forEach((t, i) => {
        let drawT = (charsUsed >= charLimit) ? "" : (charsUsed + t.length > charLimit ? t.slice(0, charLimit - charsUsed) : t);
        charsUsed += t.length;
        if (cfg.style === 'bold' && lineObj.effect !== 'flash') ctx.strokeText(drawT, 0, i * lineHeightMain);
        if (lineObj.effect === 'glitch') { ctx.fillStyle = 'red'; ctx.globalAlpha = 0.7; ctx.fillText(drawT, 5, i * lineHeightMain); ctx.fillStyle = 'blue'; ctx.fillText(drawT, -5, i * lineHeightMain); ctx.fillStyle = cfg.color; ctx.globalAlpha = alpha; }
        ctx.fillText(drawT, 0, i * lineHeightMain);
    });

    if (transLines.length > 0) {
        ctx.font = `italic 500 ${fontSizeTrans}px "${cfg.transFont === 'inherit' ? fontName : cfg.transFont}"`;
        ctx.fillStyle = cfg.accent; ctx.shadowBlur = 0;
        transLines.forEach((t, i) => ctx.fillText(t, 0, (mainLines.length * lineHeightMain) + gap + (i * lineHeightTrans)));
    }
    ctx.restore();
}

function drawVisualizer(ctx, w, h, avgVol) {
    if (!state.dataArray) return;
    const bufferLength = state.analyser.frequencyBinCount;
    const { style, color } = state.config.viz;
    ctx.fillStyle = color; ctx.shadowBlur = 10; ctx.shadowColor = color;
    if (style === 'bars') {
        const barW = (w / bufferLength) * 2.5;
        for (let i = 0; i < bufferLength; i++) ctx.fillRect(i * (barW + 1), h - (state.dataArray[i] / 255 * h * 0.3), barW, state.dataArray[i] / 255 * h * 0.3);
    } else if (style === 'wave') {
        ctx.beginPath(); ctx.lineWidth = 4; ctx.strokeStyle = color;
        const slice = w / bufferLength;
        for (let i = 0; i < bufferLength; i++) { const y = (h - 200) + (state.dataArray[i] / 128 * 100); if (i === 0) ctx.moveTo(i * slice, y); else ctx.lineTo(i * slice, y); }
        ctx.stroke();
    } else if (style === 'circle') {
        ctx.beginPath(); ctx.arc(w / 2, h / 2, 100 + avgVol * 0.5, 0, 2 * Math.PI); ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.stroke();
    }
    ctx.shadowBlur = 0;
}

function updateParticles(ctx, w, h, avgVol) {
    const { particleTheme: theme, particleColor: pColor, particleSize: sizeMult, particleSpeed: vMult } = state.config.text;

    // Incrementamos el límite para que se vea más lleno en vertical (1920px)
    const maxP = (theme === 'fire') ? 150 : (theme === 'stars' ? 100 : 150);

    // Si no hay partículas (inicio o cambio de tema), llenamos la pantalla inicialmente
    if (state.particles.length === 0 && theme !== 'none') {
        for (let i = 0; i < maxP; i++) {
            spawnParticle(theme, w, h, true);
        }
    }

    // Spawning constante: si falta gente, añadimos 1 por frame hasta llegar al tope
    if (state.particles.length < maxP) {
        spawnParticle(theme, w, h, false);
    }

    function spawnParticle(type, canvasW, canvasH, randomY = false) {
        const p = {
            x: Math.random() * canvasW,
            y: randomY ? Math.random() * canvasH : (type === 'snow' ? -20 : canvasH + 20),
            v: (2 + Math.random() * 3) * vMult,
            s: (4 + Math.random() * 8) * sizeMult,
            life: 1 + Math.random(),
            drift: (Math.random() - 0.5) * 2
        };

        if (type === 'fire') {
            p.x = (canvasW / 2) + (Math.random() - 0.5) * canvasW * 0.6;
            p.v = (4 + Math.random() * 5) * vMult;
            p.s = (10 + Math.random() * 20) * sizeMult;
        } else if (type === 'stars') {
            p.y = Math.random() * canvasH;
            p.v = 0.2 * vMult;
            p.s = (2 + Math.random() * 5) * sizeMult;
            p.life = Math.random() * Math.PI;
        }
        state.particles.push(p);
    }

    ctx.fillStyle = pColor;
    for (let i = 0; i < state.particles.length; i++) {
        let p = state.particles[i];
        if (theme === 'standard') {
            p.y -= p.v + (avgVol / 255 * 5);
            p.x += p.drift;
            ctx.globalAlpha = Math.min(0.8, Math.max(0.2, p.y / h));
        } else if (theme === 'fire') {
            p.y -= p.v + (avgVol / 255 * 4);
            p.x += Math.sin(p.y * 0.01 + p.life) * 2;
            p.s *= 0.96;
            p.life -= 0.02;
            ctx.globalAlpha = Math.max(0, p.life);
            if (p.s < 0.5 || p.life <= 0) { state.particles.splice(i, 1); i--; continue; }
        } else if (theme === 'snow') {
            p.y += p.v;
            p.x += Math.sin(p.y * 0.01);
            ctx.globalAlpha = 0.8;
        } else if (theme === 'stars') {
            p.life += (0.05 + (avgVol / 255 * 0.2)) * vMult;
            ctx.globalAlpha = 0.3 + Math.abs(Math.sin(p.life)) * 0.7;
            p.y += p.v;
        }

        if (theme !== 'fire') ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.8);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();

        // Limpieza de partículas fuera de pantalla
        if (theme === 'snow') {
            if (p.y > h + 100) { state.particles.splice(i, 1); i--; }
        } else if (theme === 'stars') {
            if (p.y > h) p.y = 0;
        } else {
            if (p.y < -100) { state.particles.splice(i, 1); i--; }
        }
    }
    ctx.globalAlpha = 1;
}

function drawCover(ctx, img, w, h) {
    const ir = (img.videoWidth || img.width) / (img.videoHeight || img.height), cr = w / h;
    let dw, dh, dx, dy;
    if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; dy = 0; } else { dw = w; dh = w / ir; dy = (h - dh) / 2; dx = 0; }
    ctx.filter = state.config.bg.blur > 0 ? `blur(${state.config.bg.blur}px)` : 'none';
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
}

function getLines(ctx, text, maxWidth) {
    const words = text.split(" "), lines = []; let curr = words[0];
    for (let i = 1; i < words.length; i++) { if (ctx.measureText(curr + " " + words[i]).width < maxWidth) curr += " " + words[i]; else { lines.push(curr); curr = words[i]; } }
    lines.push(curr); return lines;
}

function drawMetadata(ctx, w, h) {
    const { artist, song } = state.config.meta; if (!artist && !song) return;
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    if (song) { ctx.font = '700 40px "Outfit"'; ctx.fillText(song, w / 2, h - 150); }
    if (artist) { ctx.font = '400 30px "Outfit"'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(artist, w / 2, h - 105); }
    ctx.restore();
}

function drawWatermark(ctx, w, h) {
    ctx.save(); ctx.globalAlpha = state.config.watermark.opacity;
    const targetW = w * 0.25, ir = state.watermarkImage.width / state.watermarkImage.height;
    ctx.drawImage(state.watermarkImage, (w - targetW) / 2, h * 0.75, targetW, targetW / ir);
    ctx.restore();
}

function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.4, w / 2, h / 2, w);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function drawGrain(ctx, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 150; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
}

function exportVideo() {
    if (!state.audio.src) return alert("Sube audio primero");
    initAudioContext();

    const startTime = parseFloat(dom['export-start'].value) || 0;
    const endTime = parseFloat(dom['export-end'].value) || state.audio.duration;

    if (endTime <= startTime) return alert("El tiempo final debe ser mayor al inicial.");

    dom['status-msg'].textContent = "Exportando... NO CAMBIES DE PESTAÑA";
    state.audio.pause();
    state.audio.currentTime = startTime;
    if (state.bgType === 'video') state.backgroundVideo.currentTime = startTime % state.backgroundVideo.duration;

    const stream = state.canvas.captureStream(30);
    const dest = state.audioContext.createMediaStreamDestination();
    state.sourceNode.connect(dest);
    stream.addTrack(dest.stream.getAudioTracks()[0]);

    let mime = 'video/webm;codecs=vp9', ext = 'webm';
    if (!MediaRecorder.isTypeSupported(mime)) { mime = 'video/webm'; }

    const mr = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 12000000,
        audioBitsPerSecond: 256000
    }), chunks = [];

    mr.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);

    mr.onstop = () => {
        const url = URL.createObjectURL(new Blob(chunks, { type: mime }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(state.config.meta.song || 'video').replace(/\s+/g, '-')}.${ext}`;
        a.click();
        dom['status-msg'].textContent = "¡Exportado!";
        state.audio.ontimeupdate = null; // Clean up
    };

    mr.start();
    state.audio.play();
    if (state.bgType === 'video') state.backgroundVideo.play();

    // Check for end time
    state.audio.ontimeupdate = () => {
        if (state.audio.currentTime >= endTime) {
            state.audio.pause();
            mr.stop();
        }
    };

    state.audio.onended = () => {
        if (mr.state === 'recording') mr.stop();
    };
}

init();
