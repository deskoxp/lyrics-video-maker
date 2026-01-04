/**
 * LyricFlow PRO - Video Engine v3.1 (Fixed)
 * - Restored Audio Context
 * - Fixed Particle Themes & Sizing
 * - Stable Event Binding
 */

const state = {
    // Media
    audio: new Audio(),
    audioContext: null,
    analyser: null,
    dataArray: null,
    sourceNode: null,

    backgroundVideo: document.createElement('video'),
    backgroundImage: null,
    bgType: 'none',
    watermarkImage: null,

    // Data
    lyrics: [],
    translation: [],
    syncedLyrics: [],

    // Playback
    isPlaying: false,
    isSyncing: false,

    // Settings
    config: {
        bg: { blur: 0, darken: 50, scale: 1, reactive: false, intensity: 50 },
        text: {
            style: 'neon',
            animation: 'slide-up',
            color: '#ffffff',
            accent: '#00f3ff',
            particleColor: '#ffe400',
            particleTheme: 'standard', // standard, fire, snow, stars
            particleSize: 1.0, // multiplier
            width: 85,
            shadow: '#bc13fe',
            size: 50,
            transFont: 'inherit',
            transSizePct: 0.6
        },
        viz: { style: 'none', color: '#ffffff' }, // none, bars, wave, circle
        meta: { artist: '', song: '' },
        watermark: { opacity: 0.8 },
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
        'bg-blur', 'bg-darken', 'bg-scale', 'audio-reactive-bg', 'beat-intensity',
        'val-blur', 'val-darken', 'val-scale',
        'fx-particles', 'fx-vignette', 'fx-grain',
        'text-animation', 'text-color', 'accent-color', 'shadow-color', 'particle-color', 'particle-theme', 'particle-size', 'font-size',
        'trans-font', 'trans-size', 'val-trans-size', 'val-part-size',
        'viz-style', 'viz-color',
        'meta-artist', 'meta-song', 'watermark-upload', 'wm-file-name', 'wm-opacity',
        'sync-mode-btn', 'preview-btn', 'export-btn', 'play-pause-btn', 'status-msg',
        'video-canvas', 'sync-overlay', 'tap-btn', 'stop-sync-btn', 'timeline-editor',
        'sync-current-text', 'sync-next-text', 'progress-fill'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) dom[id] = el;
    });

    setupTabs();
    setupStyleSelectors();
    state.canvas = dom['video-canvas'];
    state.ctx = state.canvas.getContext('2d');

    state.audio.crossOrigin = "anonymous";
    state.backgroundVideo.loop = true;
    state.backgroundVideo.muted = true;
    state.backgroundVideo.crossOrigin = "anonymous";
    state.backgroundVideo.playsInline = true;

    setupEvents();
    requestAnimationFrame(loop);
}

function initAudioContext() {
    if (state.audioContext) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContext();
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    const bufferLength = state.analyser.frequencyBinCount;
    state.dataArray = new Uint8Array(bufferLength);

    state.sourceNode = state.audioContext.createMediaElementSource(state.audio);
    state.sourceNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);

    if (state.audioContext.state === 'suspended') state.audioContext.resume();
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
        state.syncedLyrics = [];
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
            state.backgroundVideo.play().catch(e => console.log(e));
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
        const url = URL.createObjectURL(file);
        dom['wm-file-name'].textContent = file.name;
        const img = new Image();
        img.src = url;
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

        // Theme Change Check
        const newTheme = dom['particle-theme'].value;
        if (state.config.text.particleTheme !== newTheme) {
            state.particles = [];
            state.config.text.particleTheme = newTheme;
        }

        // Particle Size
        state.config.text.particleSize = parseInt(dom['particle-size'].value) / 100;
        dom['val-part-size'].innerText = dom['particle-size'].value + '%';

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
        'text-color', 'accent-color', 'shadow-color', 'particle-color', 'particle-theme', 'particle-size',
        'font-size', 'meta-artist', 'meta-song', 'wm-opacity', 'trans-font',
        'trans-size', 'viz-style', 'viz-color'];
    inputs.forEach(id => {
        if (dom[id]) dom[id].addEventListener('input', updateConfig);
    });

    ['fx-particles', 'fx-vignette', 'fx-grain', 'audio-reactive-bg'].forEach(id => {
        if (dom[id]) dom[id].addEventListener('change', updateConfig);
    });

    dom['search-btn'].addEventListener('click', async () => {
        const query = dom['track-search'].value;
        if (!query) return;
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

    dom['export-btn'].addEventListener('click', exportVideo);
}

function parseAllLyrics() {
    const rawLines = dom['lyrics-input'].value.split('\n').filter(l => l.trim() !== '');
    state.translation = dom['lyrics-translation'].value.split('\n').filter(l => l.trim() !== '');

    // Arrays to hold parsed data
    const cleanLyrics = [];
    const parsedTimes = [];

    // Regex for LRC format: [00:12.34]Text
    const timeRegex = /^\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;

    rawLines.forEach(line => {
        const match = line.match(timeRegex);
        if (match) {
            const mins = parseFloat(match[1]);
            const secs = parseFloat(match[2]);
            const text = match[3].trim();
            cleanLyrics.push(text);
            parsedTimes.push(mins * 60 + secs);
        } else {
            cleanLyrics.push(line.trim());
            parsedTimes.push(null);
        }
    });

    state.lyrics = cleanLyrics;
    const count = state.lyrics.length;

    // Rebuild syncedLyrics preserving existing times if no LRC provided for that line
    // If array lengths mismatches, we rebuild fully.

    const oldSync = state.syncedLyrics;
    state.syncedLyrics = new Array(count).fill(0).map((_, i) => {
        let time = -1;

        // Priority 1: LRC Timestamp from this paste
        if (parsedTimes[i] !== null) {
            time = parsedTimes[i];
        }
        // Priority 2: Existing sync time (if available and index matches)
        else if (oldSync[i] && oldSync[i].time !== -1) {
            time = oldSync[i].time;
        }

        return {
            text: state.lyrics[i],
            trans: state.translation[i] || '',
            time: time
        };
    });

    // If we have parsed times, we should update the timeline editor if it's open
    if (dom['timeline-editor'].classList.contains('active')) {
        renderTimelineEditor();
    }
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
    if (state.lyrics.length === 0) return alert("Falta letra original");
    initAudioContext();

    state.isSyncing = true;
    syncIndex = 0;
    state.syncedLyrics.forEach(l => l.time = -1);
    dom['sync-overlay'].classList.remove('hidden');
    dom['timeline-editor'].classList.remove('active');

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
    dom['play-pause-btn'].innerHTML = '<i class="fa-solid fa-play"></i>';
    dom['status-msg'].textContent = "Sincronización guardada.";
    renderTimelineEditor();
}

function renderTimelineEditor() {
    const container = dom['timeline-editor'];
    container.innerHTML = '';
    container.classList.add('active');
    state.syncedLyrics.forEach((line, index) => {
        if (line.time === -1 && index >= syncIndex) return;
        const row = document.createElement('div');
        row.className = 'timeline-row';
        const timeInput = document.createElement('input');
        timeInput.type = 'number'; timeInput.step = '0.1'; timeInput.className = 'time-input';
        timeInput.value = line.time === -1 ? 0 : line.time.toFixed(2);
        timeInput.addEventListener('change', (e) => {
            const val = parseFloat(e.target.value);
            state.syncedLyrics[index].time = val;
        });
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
    if (state.audio.duration) { dom['progress-fill'].style.width = (now / state.audio.duration * 100) + '%'; }
    render(now, avgVol);
}

function render(time, avgVol) {
    const w = state.canvas.width;
    const h = state.canvas.height;
    const ctx = state.ctx;
    const cfg = state.config;

    // 1. BG
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    let scale = cfg.bg.scale;
    if (cfg.bg.reactive) {
        const pulse = (avgVol / 255) * (cfg.bg.intensity / 100) * 0.2;
        scale += pulse;
    }

    ctx.save();
    if (scale !== 1) {
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);
    }
    if (state.bgType === 'image' && state.backgroundImage) drawCover(ctx, state.backgroundImage, w, h);
    else if (state.bgType === 'video') drawCover(ctx, state.backgroundVideo, w, h);
    ctx.restore();

    if (cfg.bg.darken > 0) {
        ctx.fillStyle = `rgba(0,0,0, ${cfg.bg.darken / 100})`;
        ctx.fillRect(0, 0, w, h);
    }

    // 2. FX
    if (cfg.fx.grain) drawGrain(ctx, w, h);
    if (cfg.fx.vignette) drawVignette(ctx, w, h);

    // 3. Viz
    if (cfg.viz.style !== 'none') drawVisualizer(ctx, w, h, avgVol);

    // 4. Particles
    if (cfg.fx.particles) updateParticles(ctx, w, h, avgVol);

    // 5. Lyrics
    drawLyricsBlock(ctx, w, h, time);

    // 6. Meta
    drawMetadata(ctx, w, h);
    if (state.watermarkImage) drawWatermark(ctx, w, h);
}

function drawVisualizer(ctx, w, h, avgVol) {
    if (!state.dataArray) return;
    const bufferLength = state.analyser.frequencyBinCount;
    const style = state.config.viz.style;
    const color = state.config.viz.color;

    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    if (style === 'bars') {
        const barWidth = (w / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (state.dataArray[i] / 255) * (h * 0.3);
            ctx.fillRect(x, h - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    } else if (style === 'wave') {
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        const sliceWidth = w * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = state.dataArray[i] / 128.0;
            const y = (h - 200) + (v * 100);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();
    } else if (style === 'circle') {
        const radius = 100 + (avgVol * 0.5);
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, 2 * Math.PI);
        ctx.lineWidth = 5;
        ctx.strokeStyle = color;
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
}

function updateParticles(ctx, w, h, avgVol) {
    const theme = state.config.text.particleTheme;
    const pColor = state.config.text.particleColor;
    const sizeMult = state.config.text.particleSize || 1.0; // Multiplier

    // Config values based on theme
    const maxParticles = (theme === 'fire') ? 150 : (theme === 'stars' ? 80 : 60);
    const bassKick = avgVol > 140;

    let spawnCount = 1;
    if (bassKick) spawnCount = 3;

    if (state.particles.length < maxParticles) {
        for (let i = 0; i < spawnCount; i++) {
            let p = {
                x: Math.random() * w,
                y: h + Math.random() * 50,
                v: 2 + Math.random() * 3,
                s: (4 + Math.random() * 8) * sizeMult, // Apply size multiplier here
                life: 1.0,
                drift: (Math.random() - 0.5) * 2
            };

            if (theme === 'fire') {
                p.x = (w / 2) + ((Math.random() - 0.5) * w * 0.6);
                p.y = h + Math.random() * 50;
                p.v = 4 + Math.random() * 5;
                p.s = (10 + Math.random() * 20) * sizeMult;
                p.life = 1.0;
            } else if (theme === 'snow') {
                p.y = -Math.random() * 50;
                p.v = 1 + Math.random() * 2;
                p.s = (3 + Math.random() * 6) * sizeMult;
                p.life = 1.0;
            } else if (theme === 'stars') {
                p.x = Math.random() * w;
                p.y = Math.random() * h;
                p.v = 0;
                p.s = (2 + Math.random() * 5) * sizeMult;
                p.life = Math.random() * Math.PI;
            }
            state.particles.push(p);
        }
    }

    ctx.fillStyle = pColor;

    for (let i = 0; i < state.particles.length; i++) {
        let p = state.particles[i];

        // Physics & Movement
        if (theme === 'standard') {
            const audioForce = (avgVol / 255) * 5;
            p.y -= p.v + audioForce;
            p.x += p.drift;
            const progress = p.y / h;
            ctx.globalAlpha = Math.min(1, Math.max(0.2, progress));

        } else if (theme === 'fire') {
            p.y -= p.v + ((avgVol / 255) * 4);
            p.x += Math.sin(p.y * 0.01 + p.life) * 2;
            p.s *= 0.96;
            p.life -= 0.02;
            ctx.globalAlpha = Math.max(0, p.life);
            if (p.s < 0.5 || p.life <= 0) {
                state.particles.splice(i, 1); i--; continue;
            }

        } else if (theme === 'snow') {
            p.y += p.v;
            p.x += Math.sin(p.y * 0.01) * 1;
            ctx.globalAlpha = 0.8;

        } else if (theme === 'stars') {
            p.life += 0.05 + ((avgVol / 255) * 0.2);
            const opacity = 0.3 + (Math.abs(Math.sin(p.life)) * 0.7);
            ctx.globalAlpha = opacity;
            p.y += 0.2;
        }

        if (theme !== 'fire') ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.8);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();

        if ((theme !== 'fire' && theme !== 'snow') && p.y < -50) {
            state.particles.splice(i, 1); i--;
        } else if (theme === 'snow' && p.y > h + 50) {
            state.particles.splice(i, 1); i--;
        } else if (theme === 'stars' && p.y > h + 10) {
            p.y = -10; p.x = Math.random() * w;
        }
    }
    ctx.globalAlpha = 1;
}

function drawCover(ctx, img, w, h) {
    const imgRatio = (img.videoWidth || img.width) / (img.videoHeight || img.height);
    const cvsRatio = w / h;
    let dw, dh, dx, dy;
    if (imgRatio > cvsRatio) { dh = h; dw = h * imgRatio; dx = (w - dw) / 2; dy = 0; }
    else { dw = w; dh = w / imgRatio; dy = (h - dh) / 2; dx = 0; }

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
        if (width < maxWidth) currentLine += " " + word;
        else { lines.push(currentLine); currentLine = word; }
    }
    lines.push(currentLine);
    return lines;
}

function drawLyricsBlock(ctx, w, h, time) {
    const cfg = state.config.text;

    let idx = -1;
    for (let i = 0; i < state.syncedLyrics.length; i++) {
        if (state.syncedLyrics[i].time <= time && state.syncedLyrics[i].time !== -1) idx = i;
        else if (state.syncedLyrics[i].time > time) break;
    }
    if (idx === -1) return;

    const lineObj = state.syncedLyrics[idx];
    const duration = time - lineObj.time;

    let fontName = 'Outfit';
    if (cfg.style === 'serif') fontName = 'serif';
    if (cfg.style === 'arcade') fontName = 'Courier New';

    const fontSizeMain = cfg.size * 2;
    const maxWidth = w * 0.85;

    // Main Lines
    ctx.font = `800 ${fontSizeMain}px "${fontName}"`;
    const mainLines = getLines(ctx, lineObj.text, maxWidth);
    const lineHeightMain = fontSizeMain * 1.25;

    let transLines = [];
    let fontSizeTrans = fontSizeMain * (cfg.transSizePct || 0.6);
    if (lineObj.trans) {
        ctx.font = `italic 500 ${fontSizeTrans}px "${cfg.transFont === 'inherit' ? fontName : cfg.transFont}"`;
        transLines = getLines(ctx, lineObj.trans, maxWidth);
    }
    const lineHeightTrans = fontSizeTrans * 1.4;
    const gap = 40;
    const realTotalHeight = (mainLines.length * lineHeightMain) +
        (transLines.length > 0 ? gap + (transLines.length * lineHeightTrans) : 0);
    let startY = (h / 2) - (realTotalHeight / 2) + (lineHeightMain * 0.7);

    let alpha = 1, yAnim = 0, scale = 1;
    const animDur = 0.5;

    let charLimit = 9999;
    if (cfg.animation === 'typewriter') {
        const typeSpeed = 0.05;
        charLimit = Math.floor(duration / typeSpeed);
    } else if (duration < animDur) {
        const p = duration / animDur;
        const ease = p * (2 - p);
        if (cfg.animation === 'fade') alpha = ease;
        if (cfg.animation === 'slide-up') { alpha = ease; yAnim = 80 * (1 - ease); }
        if (cfg.animation === 'zoom-in') { scale = 0.8 + (0.2 * ease); alpha = ease; }
    }

    ctx.save();
    ctx.translate(w / 2, startY + yAnim);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    ctx.font = `800 ${fontSizeMain}px "${fontName}"`;
    if (cfg.style === 'neon') { ctx.shadowColor = cfg.shadow; ctx.shadowBlur = 40; ctx.fillStyle = cfg.color; }
    else if (cfg.style === 'bold') { ctx.shadowBlur = 0; ctx.strokeStyle = 'black'; ctx.lineWidth = 6; ctx.fillStyle = cfg.color; }
    else { ctx.fillStyle = cfg.color; ctx.shadowBlur = 0; }

    let charsDrawn = 0;
    mainLines.forEach((t, i) => {
        let textToDraw = t;
        if (cfg.animation === 'typewriter') {
            if (charsDrawn >= charLimit) textToDraw = "";
            else if (charsDrawn + t.length > charLimit) textToDraw = t.substring(0, charLimit - charsDrawn);
            charsDrawn += t.length;
        }

        if (cfg.style === 'bold') ctx.strokeText(textToDraw, 0, i * lineHeightMain);
        ctx.fillText(textToDraw, 0, i * lineHeightMain);
    });

    if (transLines.length > 0) {
        const transStartY = (mainLines.length * lineHeightMain) + gap;
        ctx.font = `italic 500 ${fontSizeTrans}px "${cfg.transFont === 'inherit' ? fontName : cfg.transFont}"`;
        ctx.fillStyle = cfg.accent;
        ctx.shadowBlur = 0;

        transLines.forEach((t, i) => {
            const ly = transStartY + (i * lineHeightTrans);
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
    if (state.config.meta.song) { ctx.font = '700 40px "Outfit"'; ctx.fillText(state.config.meta.song, w / 2, yPos); }
    if (state.config.meta.artist) { ctx.font = '400 30px "Outfit"'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(state.config.meta.artist, w / 2, yPos + 45); }
    ctx.restore();
}

function drawWatermark(ctx, w, h) {
    if (!state.watermarkImage) return;
    ctx.save();
    ctx.globalAlpha = state.config.watermark.opacity;
    const targetW = w * 0.25;
    const imgRatio = state.watermarkImage.width / state.watermarkImage.height;
    const targetH = targetW / imgRatio;
    const x = (w - targetW) / 2;
    const y = h * 0.75;
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
    for (let i = 0; i < 150; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
}

function exportVideo() {
    if (!state.audio.src) return alert("Nada que exportar");
    initAudioContext();

    dom['status-msg'].textContent = "Iniciando grabación... NO CAMBIES DE PESTAÑA";
    state.audio.pause();
    state.audio.currentTime = 0;
    if (state.bgType === 'video') state.backgroundVideo.currentTime = 0;

    const stream = state.canvas.captureStream(30);
    const dest = state.audioContext.createMediaStreamDestination();
    state.sourceNode.connect(dest);

    stream.addTrack(dest.stream.getAudioTracks()[0]);

    // Format selection
    let mimeType = 'video/webm;codecs=vp9';
    let ext = 'webm';

    if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        ext = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
    } else {
        mimeType = 'video/webm';
    }

    console.log("Exporting as:", mimeType);

    const mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
    const chunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
        const title = state.config.meta.song ? state.config.meta.song.replace(/\s+/g, '-') : 'lyric-video';
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.${ext}`;
        a.click();
        dom['status-msg'].textContent = "¡Video Exportado!";
    };

    mediaRecorder.start();
    state.audio.play();
    if (state.bgType === 'video') state.backgroundVideo.play();
    state.audio.onended = () => mediaRecorder.stop();
}

init();
