/**
 * DESKOEDITOR V1 - Core Application
 * Orchestrates State, Events, and Modules.
 */

import { RenderEngine } from './render-engine.js';
import { LyricParser } from './lyric-parser.js';
import { VideoExporter } from './video-exporter.js';

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
    needsRender: true,
    isExporting: false,

    config: {
        bg: { blur: 0, darken: 50, scale: 1, delay: 0, reactive: false, intensity: 50 },
        text: {
            style: 'neon', animation: 'slide-up', color: '#ffffff', accent: '#00f3ff', shadow: '#bc13fe',
            size: 50, transColor: '#f472b6', transAccent: '#ffffff', transShadow: '#000000',
            transFont: 'inherit', transSizePct: 0.6, particleColor: '#ffe400', particleTheme: 'standard',
            particleSize: 1.0, particleSpeed: 1.0, width: 85
        },
        viz: { style: 'none', color: '#ffffff' },
        meta: { artist: '', song: '' },
        watermark: { opacity: 0.8 },
        fx: { particles: true, vignette: true, grain: false }
    },

    canvas: null,
    ctx: null,
    particles: [],
    popup: { window: null, canvas: null, ctx: null },
    lyricType: 'text'
};

const dom = {};

function init() {
    const ids = [
        'audio-upload', 'file-name', 'bg-upload', 'bg-file-name', 'track-search', 'search-btn',
        'lyrics-input', 'lyrics-translation', 'bg-blur', 'bg-darken', 'bg-scale', 'bg-delay',
        'audio-reactive-bg', 'beat-intensity', 'val-blur', 'val-darken', 'val-scale', 'val-bg-delay',
        'fx-particles', 'fx-vignette', 'fx-grain', 'text-animation', 'text-color', 'accent-color',
        'shadow-color', 'font-size', 'val-font-size', 'trans-color', 'trans-accent', 'trans-shadow',
        'trans-font', 'trans-size', 'val-trans-size', 'particle-color', 'particle-theme', 'particle-size',
        'particle-speed', 'val-part-size', 'val-part-speed', 'viz-style', 'viz-color', 'meta-artist',
        'meta-song', 'watermark-upload', 'wm-file-name', 'wm-opacity', 'sync-mode-btn', 'preview-btn',
        'popup-btn', 'export-btn', 'play-pause-btn', 'status-msg', 'video-canvas', 'sync-overlay',
        'tap-btn', 'stop-sync-btn', 'timeline-editor', 'sync-current-text', 'sync-next-text',
        'progress-fill', 'volume-slider', 'export-start', 'export-end', 'set-start-btn', 'set-end-btn',
        'progress-track', 'time-code', 'apple-lyrics-input', 'apple-trans-editor'
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

    setupTabs();
    setupStyleSelectors();
    setupEvents();
    setupPresets();
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

function setupEvents() {
    // Audio Upload
    dom['audio-upload']?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // More inclusive check for audio files
        const isAudio = file.type.startsWith('audio/') ||
            file.name.toLowerCase().endsWith('.mp3') ||
            file.name.toLowerCase().endsWith('.m4a') ||
            file.name.toLowerCase().endsWith('.wav');

        if (!isAudio) return showError("El archivo no parece un audio válido (mp3, m4a, wav).");

        if (state.audio.src.startsWith('blob:')) URL.revokeObjectURL(state.audio.src);
        state.audio.src = URL.createObjectURL(file);
        dom['file-name'].textContent = file.name;
        showStatus("Audio cargado correctamente");
        state.needsRender = true;
    });

    // Background Upload
    dom['bg-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (state.backgroundVideo.src.startsWith('blob:')) URL.revokeObjectURL(state.backgroundVideo.src);
        if (state.backgroundImage?.src.startsWith('blob:')) URL.revokeObjectURL(state.backgroundImage.src);

        const url = URL.createObjectURL(file);
        dom['bg-file-name'].textContent = file.name;
        if (file.type.startsWith('video')) {
            state.backgroundVideo.src = url;
            state.bgType = 'video';
            state.backgroundImage = null;
            state.backgroundVideo.play().catch(e => showError("Error vídeo fondo"));
        } else {
            const img = new Image();
            img.onload = () => { state.backgroundImage = img; state.bgType = 'image'; showStatus("Imagen cargada"); };
            img.src = url;
        }
    });

    // Config Inputs
    const updateConfig = () => {
        if (!dom['bg-blur']) return; // Guard against non-existent UI
        state.config.bg.blur = parseInt(dom['bg-blur'].value);
        state.config.bg.darken = parseInt(dom['bg-darken'].value);
        state.config.bg.scale = parseInt(dom['bg-scale'].value) / 100;
        state.config.bg.delay = parseFloat(dom['bg-delay'].value);
        state.config.bg.reactive = dom['audio-reactive-bg'].checked;
        state.config.bg.intensity = parseInt(dom['beat-intensity'].value);

        if (dom['val-blur']) dom['val-blur'].innerText = state.config.bg.blur + 'px';
        if (dom['val-darken']) dom['val-darken'].innerText = state.config.bg.darken + '%';
        if (dom['val-scale']) dom['val-scale'].innerText = Math.round(state.config.bg.scale * 100) + '%';
        if (dom['val-bg-delay']) dom['val-bg-delay'].innerText = state.config.bg.delay.toFixed(1) + 's';

        state.config.text.animation = dom['text-animation'].value;
        state.config.text.color = dom['text-color'].value;
        state.config.text.accent = dom['accent-color'].value;
        state.config.text.shadow = dom['shadow-color'].value;
        state.config.text.size = parseInt(dom['font-size'].value);
        if (dom['val-font-size']) dom['val-font-size'].innerText = state.config.text.size + 'px';

        state.config.text.transColor = dom['trans-color'].value;
        state.config.text.transAccent = dom['trans-accent'].value;
        state.config.text.transShadow = dom['trans-shadow'].value;
        state.config.text.transFont = dom['trans-font'].value;
        state.config.text.transSizePct = parseInt(dom['trans-size'].value) / 100;
        if (dom['val-trans-size']) dom['val-trans-size'].innerText = dom['trans-size'].value + '%';

        state.config.text.particleColor = dom['particle-color'].value;
        const newTheme = dom['particle-theme'].value;
        if (state.config.text.particleTheme !== newTheme) { state.particles = []; state.config.text.particleTheme = newTheme; }

        state.config.text.particleSize = parseInt(dom['particle-size'].value) / 100;
        if (dom['val-part-size']) dom['val-part-size'].innerText = dom['particle-size'].value + '%';
        state.config.text.particleSpeed = parseInt(dom['particle-speed'].value) / 100;
        if (dom['val-part-speed']) dom['val-part-speed'].innerText = dom['particle-speed'].value + '%';

        state.config.viz.style = dom['viz-style'].value;
        state.config.viz.color = dom['viz-color'].value;
        state.config.meta.artist = dom['meta-artist'].value;
        state.config.meta.song = dom['meta-song'].value;
        state.config.watermark.opacity = parseInt(dom['wm-opacity'].value) / 100;
        state.config.fx.particles = dom['fx-particles'].checked;
        state.config.fx.vignette = dom['fx-vignette'].checked;
        state.config.fx.grain = dom['fx-grain'].checked;
        state.needsRender = true;
    };

    const inputIds = ['bg-blur', 'bg-darken', 'bg-scale', 'bg-delay', 'beat-intensity', 'text-animation',
        'text-color', 'accent-color', 'shadow-color', 'font-size', 'trans-color', 'trans-accent',
        'trans-shadow', 'trans-font', 'trans-size', 'particle-color', 'particle-theme', 'particle-size',
        'particle-speed', 'meta-artist', 'meta-song', 'wm-opacity', 'viz-style', 'viz-color'];

    inputIds.forEach(id => dom[id]?.addEventListener('input', updateConfig));
    ['fx-particles', 'fx-vignette', 'fx-grain', 'audio-reactive-bg'].forEach(id => dom[id]?.addEventListener('change', updateConfig));

    // Lyrics & Search
    dom['search-btn'].addEventListener('click', handleSearch);
    dom['lyrics-input'].addEventListener('input', parseAllLyrics);
    dom['apple-lyrics-input'].addEventListener('input', parseAllLyrics);
    dom['lyrics-translation'].addEventListener('input', parseAllLyrics);

    // Playback & Sync
    dom['play-pause-btn'].addEventListener('click', togglePlay);
    dom['sync-mode-btn'].addEventListener('click', startSync);
    dom['stop-sync-btn'].addEventListener('click', endSync);
    dom['tap-btn'].addEventListener('click', handleTap);
    document.addEventListener('keydown', e => { if (state.isSyncing && e.code === 'Space') handleTap(); });

    dom['preview-btn'].addEventListener('click', () => {
        initAudioContext(); state.audio.currentTime = 0; state.audio.play();
        if (state.bgType === 'video') state.backgroundVideo.play();
        state.isPlaying = true;
    });

    dom['export-btn'].addEventListener('click', () => {
        VideoExporter.export(state.canvas, state.audio, state, dom, {
            showStatus, showError, initAudioContext,
            onComplete: () => { state.isExporting = false; }
        });
        state.isExporting = true;
    });

    dom['progress-track'].addEventListener('click', (e) => {
        if (!state.audio.duration) return;
        const rect = dom['progress-track'].getBoundingClientRect();
        state.audio.currentTime = ((e.clientX - rect.left) / rect.width) * state.audio.duration;
    });

    dom['volume-slider']?.addEventListener('input', (e) => {
        state.audio.volume = parseFloat(e.target.value);
    });

    dom['set-start-btn']?.addEventListener('click', () => {
        dom['export-start'].value = state.audio.currentTime.toFixed(1);
    });

    dom['set-end-btn']?.addEventListener('click', () => {
        dom['export-end'].value = state.audio.currentTime.toFixed(1);
    });

    dom['popup-btn']?.addEventListener('click', openOBSPopup);

    // Watermark
    dom['watermark-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file?.type.startsWith('image/')) return showError("Imagen no válida");
        const img = new Image();
        img.onload = () => { state.watermarkImage = img; showStatus("Sello cargado"); };
        img.src = URL.createObjectURL(file);
    });
}

function openOBSPopup() {
    const w = 1080, h = 1920;
    const popup = window.open('', 'DESKO_OBS', `width=${w / 4},height=${h / 4}`);
    if (!popup) return alert("Habilita popups");

    popup.document.body.innerHTML = `<style>body{margin:0;background:#000;height:100vh;display:flex;align-items:center;justify-content:center;}canvas{max-width:100%;max-height:100%;object-fit:contain;}</style><canvas id="obs-cvs" width="${w}" height="${h}"></canvas>`;
    state.popup.window = popup;
    state.popup.canvas = popup.document.getElementById('obs-cvs');
    state.popup.ctx = state.popup.canvas.getContext('2d');

    popup.onbeforeunload = () => { state.popup.window = state.popup.canvas = state.popup.ctx = null; };
}

// Logic implementations calling modules
async function handleSearch() {
    const query = dom['track-search'].value;
    if (!query.includes('-')) return showError("Formato: Artista - Canción");
    const [artist, title] = query.split('-').map(s => s.trim());
    showStatus("Buscando...");
    try {
        const res = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
        const data = await res.json();
        if (data.lyrics) { dom['lyrics-input'].value = data.lyrics; parseAllLyrics(); showStatus("Letra OK"); }
        else showError("No encontrado");
    } catch (e) { showError("Error búsqueda"); }
}

function parseAllLyrics() {
    const translations = dom['lyrics-translation'].value.split('\n');
    if (state.lyricType === 'apple') {
        try {
            state.syncedLyrics = LyricParser.parseAppleJSON(dom['apple-lyrics-input'].value, translations);
            renderAppleTranslationEditor();
            showStatus("Apple Lyrics OK");
        } catch (e) { showError(e.message); }
    } else {
        state.syncedLyrics = LyricParser.parseLRC(dom['lyrics-input'].value, translations);
    }
    if (dom['timeline-editor'].classList.contains('active')) renderTimelineEditor();
    state.needsRender = true;
}

function loop() {
    requestAnimationFrame(loop);
    if (!(state.isPlaying || state.isSyncing || state.needsRender || state.isExporting)) return;

    let avgVol = 0;
    if (state.analyser) {
        state.analyser.getByteFrequencyData(state.dataArray);
        let sum = 0; for (let i = 0; i < 20; i++) sum += state.dataArray[i];
        avgVol = sum / 20;
    }
    const now = state.audio.currentTime;
    updateUIPos(now);
    syncBackgroundVideo(now);
    renderFrame(now, avgVol);
    state.needsRender = false;
}

function syncBackgroundVideo(now) {
    if (state.bgType === 'video' && state.isPlaying && state.backgroundVideo.duration) {
        const targetTime = (now + state.config.bg.delay) % state.backgroundVideo.duration;
        const actualTime = state.backgroundVideo.currentTime;
        const diff = Math.abs(targetTime - actualTime);
        if (diff > 0.3) {
            state.backgroundVideo.currentTime = targetTime < 0 ? targetTime + state.backgroundVideo.duration : targetTime;
        }
    }
}

function updateUIPos(now) {
    if (state.audio.duration) {
        dom['progress-fill'].style.width = (now / state.audio.duration * 100) + '%';
        const mins = Math.floor(now / 60), secs = Math.floor(now % 60);
        dom['time-code'].textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

function renderFrame(time, avgVol) {
    const { canvas: cvs, ctx, config: cfg } = state;
    const { width: w, height: h } = cvs;

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);

    let scale = cfg.bg.scale + (cfg.bg.reactive ? (avgVol / 255) * (cfg.bg.intensity / 100) * 0.2 : 0);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2);
    if (state.bgType === 'image') RenderEngine.drawCover(ctx, state.backgroundImage, w, h, cfg.bg.blur);
    else if (state.bgType === 'video') RenderEngine.drawCover(ctx, state.backgroundVideo, w, h, cfg.bg.blur);
    ctx.restore();

    if (cfg.bg.darken > 0) { ctx.fillStyle = `rgba(0,0,0, ${cfg.bg.darken / 100})`; ctx.fillRect(0, 0, w, h); }
    if (cfg.fx.grain) RenderEngine.drawGrain(ctx, w, h);
    if (cfg.fx.vignette) RenderEngine.drawVignette(ctx, w, h);
    if (cfg.viz.style !== 'none') RenderEngine.drawVisualizer(ctx, w, h, avgVol, state);
    if (cfg.fx.particles) RenderEngine.updateParticles(ctx, w, h, avgVol, state);

    RenderEngine.drawLyricsBlock(ctx, w, h, time, avgVol, state);
    RenderEngine.drawMetadata(ctx, w, h, cfg.meta);
    if (state.watermarkImage) RenderEngine.drawWatermark(ctx, w, h, state.watermarkImage, cfg.watermark.opacity);

    // Sync to OBS Popup if open
    if (state.popup.ctx) {
        state.popup.ctx.drawImage(cvs, 0, 0);
    }
}

// Utility UI functions remain in script.js as they interact with DOM
function togglePlay() {
    initAudioContext();
    if (state.isPlaying) {
        state.audio.pause(); state.backgroundVideo.pause(); state.isPlaying = false;
        dom['play-pause-btn'].innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
        state.audio.play(); state.backgroundVideo.play(); state.isPlaying = true;
        dom['play-pause-btn'].innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
}

function startSync() {
    initAudioContext(); state.isSyncing = true; state.audio.currentTime = 0; state.audio.play(); state.isPlaying = true;
    dom['sync-overlay'].classList.remove('hidden'); updateSyncUI();
}

function handleTap() {
    if (!state.isSyncing) return;
    const idx = state.syncedLyrics.findIndex(l => l.time === -1);
    if (idx !== -1) { state.syncedLyrics[idx].time = state.audio.currentTime; updateSyncUI(); }
}

function endSync() {
    state.isSyncing = false; dom['sync-overlay'].classList.add('hidden');
    state.audio.pause(); state.isPlaying = false; renderTimelineEditor();
}

function showStatus(msg) { dom['status-msg'].textContent = msg; dom['status-msg'].style.color = 'var(--primary)'; }
function showError(msg) { dom['status-msg'].textContent = msg; dom['status-msg'].style.color = '#ff4d4d'; }

// Remaining UI setup functions
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
        b.classList.add('active'); document.getElementById(`tab-${b.dataset.tab}`).classList.add('active');
    }));
    document.querySelectorAll('.lyric-tab-btn').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.lyric-tab-btn, .lyric-tab-content').forEach(el => el.classList.remove('active'));
        b.classList.add('active'); document.getElementById(`lyric-content-${b.dataset.lyricTab}`).classList.add('active');
        state.lyricType = b.dataset.lyricTab; parseAllLyrics();
    }));
}

function setupStyleSelectors() {
    document.querySelectorAll('.style-option').forEach(opt => opt.addEventListener('click', () => {
        document.querySelectorAll('.style-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active'); state.config.text.style = opt.dataset.style; state.needsRender = true;
    }));
}

function setupPresets() {
    const presetContainer = document.createElement('div');
    presetContainer.className = 'control-group';
    presetContainer.innerHTML = `
        <h3>Presets de Estilo</h3>
        <div class="input-with-btn">
            <input type="text" id="preset-name-input" placeholder="Nombre del preset" style="padding: 0.5rem; font-size: 0.8rem;">
            <button id="save-preset-btn-action" class="small-btn" style="width: 40px;"><i class="fa-solid fa-save"></i></button>
        </div>
        <div id="preset-list-container" class="preset-pill-container" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px;"></div>
    `;

    const textTab = document.getElementById('tab-text');
    if (textTab) textTab.insertBefore(presetContainer, textTab.firstChild);

    // Re-bind locally to avoid dependency on global init ids
    const saveBtn = document.getElementById('save-preset-btn-action');
    const nameInput = document.getElementById('preset-name-input');
    const listContainer = document.getElementById('preset-list-container');

    const presets = JSON.parse(localStorage.getItem('desko_presets') || '{}');

    const renderPresets = () => {
        if (!listContainer) return;
        listContainer.innerHTML = '';
        Object.keys(presets).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'preset-pill';
            btn.style.cssText = 'background: var(--bg-card); border: 1px solid var(--border); color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; cursor: pointer; margin: 2px;';
            btn.innerHTML = `${name} <i class="fa-solid fa-times" style="margin-left:5px; opacity:0.5"></i>`;

            btn.onclick = (e) => {
                if (e.target.classList.contains('fa-times')) {
                    delete presets[name];
                    localStorage.setItem('desko_presets', JSON.stringify(presets));
                    renderPresets();
                } else {
                    applyPreset(presets[name]);
                    showStatus(`Preset "${name}" aplicado`);
                }
            };
            listContainer.appendChild(btn);
        });
    };

    const applyPreset = (data) => {
        if (data.text) Object.assign(state.config.text, data.text);
        if (data.bg) Object.assign(state.config.bg, data.bg);
        syncUIWithConfig();
        state.needsRender = true;
    };

    saveBtn?.addEventListener('click', () => {
        const name = nameInput?.value.trim();
        if (!name) return showError("Escribe un nombre para el preset");
        presets[name] = {
            text: JSON.parse(JSON.stringify(state.config.text)),
            bg: JSON.parse(JSON.stringify(state.config.bg))
        };
        localStorage.setItem('desko_presets', JSON.stringify(presets));
        nameInput.value = '';
        renderPresets();
        showStatus("¡Preset guardado!");
    });

    renderPresets();
}

function syncUIWithConfig() {
    const mapping = {
        'bg-blur': state.config.bg.blur,
        'bg-darken': state.config.bg.darken,
        'bg-scale': state.config.bg.scale * 100,
        'font-size': state.config.text.size,
        'text-color': state.config.text.color,
        'accent-color': state.config.text.accent,
        'shadow-color': state.config.text.shadow
    };
    Object.keys(mapping).forEach(id => {
        if (dom[id]) dom[id].value = mapping[id];
    });
}

function renderTimelineEditor() {
    const container = dom['timeline-editor'];
    if (!container) return;
    container.innerHTML = '';
    container.classList.add('active');
    state.syncedLyrics.forEach((line, index) => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        row.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 5px; border-bottom: 1px solid var(--border);';

        const timeInput = document.createElement('input');
        timeInput.type = 'number'; timeInput.step = '0.1';
        timeInput.style.cssText = 'width: 70px; background: var(--bg-main); color: white; border: 1px solid var(--border); border-radius: 4px; padding: 2px 5px;';
        timeInput.value = line.time === -1 ? 0 : line.time.toFixed(2);

        timeInput.addEventListener('change', (e) => {
            state.syncedLyrics[index].time = parseFloat(e.target.value);
            state.needsRender = true;
        });

        const textSpan = document.createElement('span');
        textSpan.style.fontSize = '0.8rem';
        textSpan.textContent = line.text;

        row.appendChild(timeInput);
        row.appendChild(textSpan);
        container.appendChild(row);
    });
}

function renderAppleTranslationEditor() {
    const container = dom['apple-trans-editor'];
    if (!container) return;
    container.innerHTML = '<h4 style="margin: 0.5rem 0; font-size: 0.8rem; color: var(--primary);">Traductor de Líneas</h4>';

    state.syncedLyrics.forEach((line, index) => {
        if (index > 0 && line.type !== 'instrumental' && state.syncedLyrics[index - 1].type !== 'instrumental') {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-instrumental-btn';
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir Pausa';
            addBtn.onclick = () => injectInstrumental(index);
            container.appendChild(addBtn);
        }

        const row = document.createElement('div');
        row.className = 'apple-trans-row' + (line.type === 'instrumental' ? ' instrumental' : '');

        const header = document.createElement('div');
        header.className = 'apple-trans-header';
        header.innerHTML = `<div class="apple-trans-orig">${line.type === 'instrumental' ? 'Instrumental 🎵' : line.text}</div>`;

        const actions = document.createElement('div');
        actions.className = 'apple-trans-actions';

        const select = document.createElement('select');
        select.className = 'effect-select';
        ['none', 'pulse', 'glitch', 'flash'].forEach(eff => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = eff;
            if (line.effect === eff) opt.selected = true;
            select.appendChild(opt);
        });
        select.onchange = (e) => state.syncedLyrics[index].effect = e.target.value;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-line-btn';
        removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        removeBtn.onclick = () => { state.syncedLyrics.splice(index, 1); renderAppleTranslationEditor(); };

        actions.appendChild(select);
        actions.appendChild(removeBtn);
        header.appendChild(actions);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'apple-trans-input';
        input.value = line.trans || '';
        input.oninput = (e) => { state.syncedLyrics[index].trans = e.target.value; state.needsRender = true; };

        row.appendChild(header);
        row.appendChild(input);
        container.appendChild(row);
    });
}

function injectInstrumental(index) {
    const start = state.syncedLyrics[index - 1].endTime || state.syncedLyrics[index - 1].time;
    const end = state.syncedLyrics[index].time;
    state.syncedLyrics.splice(index, 0, {
        text: '🎵', trans: '', time: start, endTime: end, type: 'instrumental',
        syllables: [{ text: '🎵', begin: start, end: end }]
    });
    renderAppleTranslationEditor();
}

function updateSyncUI() {
    const nextIdx = state.syncedLyrics.findIndex(l => l.time === -1);
    if (nextIdx !== -1) {
        dom['sync-current-text'].textContent = nextIdx > 0 ? state.syncedLyrics[nextIdx - 1].text : "Preparado...";
        dom['sync-next-text'].textContent = state.syncedLyrics[nextIdx].text;
    } else {
        dom['sync-current-text'].textContent = "¡Fin de la letra!";
        dom['sync-next-text'].textContent = "";
        setTimeout(endSync, 1500);
    }
}

init();
