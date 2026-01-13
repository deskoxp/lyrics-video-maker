/**
 * DESKOEDITOR V1 - Aplicación Consolidada
 * Versión sin módulos ES6 para compatibilidad con file://
 */

// ============================================================================
// LYRIC PARSER
// ============================================================================
const LyricParser = {
    parseTTMLTime(timeStr) {
        if (!timeStr) return 0;
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
        }
        return parseFloat(timeStr);
    },

    parseAppleJSON(rawJSON, translations = []) {
        const json = JSON.parse(rawJSON);
        if (!json.data?.[0]?.attributes?.ttmlLocalizations) {
            throw new Error("Formato JSON de Apple Music no válido.");
        }

        const ttml = json.data[0].attributes.ttmlLocalizations;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(ttml, "text/xml");

        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            throw new Error("Error en el XML/TTML contenido en el JSON.");
        }

        const lines = xmlDoc.getElementsByTagName("p");
        return Array.from(lines).map((p, i) => {
            const spans = p.getElementsByTagName("span");
            const syllables = [];
            for (let j = 0; j < spans.length; j++) {
                let text = spans[j].textContent;
                const nextNode = spans[j].nextSibling;
                if (nextNode?.nodeType === 3) text += nextNode.textContent;

                syllables.push({
                    text: text,
                    begin: this.parseTTMLTime(spans[j].getAttribute("begin")),
                    end: this.parseTTMLTime(spans[j].getAttribute("end"))
                });
            }

            return {
                text: p.textContent.trim().replace(/\s+/g, ' '),
                trans: translations[i] || '',
                time: this.parseTTMLTime(p.getAttribute("begin")),
                endTime: this.parseTTMLTime(p.getAttribute("end")),
                syllables: syllables,
                type: 'karaoke'
            };
        });
    },

    parseLRC(rawText, translations = []) {
        const lines = rawText.split('\n').filter(l => l.trim() !== '');
        const timeRegex = /^\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;

        return lines.map((line, i) => {
            let text = line.trim();
            let time = -1;
            const match = text.match(timeRegex);

            if (match) {
                time = parseFloat(match[1]) * 60 + parseFloat(match[2]);
                text = match[3].trim();
            }

            let effect = 'none';
            if (text.startsWith('***') && text.endsWith('***')) {
                effect = 'pulse'; text = text.slice(3, -3).trim();
            } else if (text.startsWith('%%%') && text.endsWith('%%%')) {
                effect = 'glitch'; text = text.slice(3, -3).trim();
            } else if (text.startsWith('###') && text.endsWith('###')) {
                effect = 'flash'; text = text.slice(3, -3).trim();
            }

            return { text, trans: translations[i] || '', time, effect, type: 'lrc' };
        });
    }
};

// ============================================================================
// RENDER ENGINE
// ============================================================================
const RenderEngine = {
    drawCover(ctx, img, w, h, blur) {
        if (!img) return;
        const ir = (img.videoWidth || img.width) / (img.videoHeight || img.height);
        const cr = w / h;
        let dw, dh, dx, dy;

        if (ir > cr) {
            dh = h; dw = h * ir; dx = (w - dw) / 2; dy = 0;
        } else {
            dw = w; dh = w / ir; dy = (h - dh) / 2; dx = 0;
        }

        ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.filter = 'none';
    },

    drawVignette(ctx, w, h) {
        const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.4, w / 2, h / 2, w);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    },

    drawGrain(ctx, w, h) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 150; i++) {
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
    },

    getLines(ctx, text, maxWidth) {
        const words = text.split(" "), lines = [];
        let curr = words[0];
        for (let i = 1; i < words.length; i++) {
            if (ctx.measureText(curr + " " + words[i]).width < maxWidth) {
                curr += " " + words[i];
            } else {
                lines.push(curr);
                curr = words[i];
            }
        }
        lines.push(curr);
        return lines;
    },

    drawMetadata(ctx, w, h, meta) {
        if (!meta.artist && !meta.song) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        if (meta.song) {
            ctx.font = '700 40px "Outfit"';
            ctx.fillText(meta.song, w / 2, h - 150);
        }
        if (meta.artist) {
            ctx.font = '400 30px "Outfit"';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(meta.artist, w / 2, h - 105);
        }
        ctx.restore();
    },

    drawWatermark(ctx, w, h, img, opacity) {
        if (!img) return;
        ctx.save();
        ctx.globalAlpha = opacity;
        const targetW = w * 0.25;
        const ir = img.width / img.height;
        ctx.drawImage(img, (w - targetW) / 2, h * 0.75, targetW, targetW / ir);
        ctx.restore();
    },

    drawBandLogo(ctx, w, h, img, config) {
        if (!img) return;
        ctx.save();
        ctx.globalAlpha = config.opacity || 1.0;
        const targetW = w * config.scale;
        const ir = img.width / img.height;
        const targetH = targetW / ir;

        const posX = (w * config.x / 100) - (targetW / 2);
        const posY = (h * config.y / 100) - (targetH / 2);

        ctx.drawImage(img, posX, posY, targetW, targetH);
        ctx.restore();
    },

    drawLyricsBlock(ctx, w, h, time, avgVol, state) {
        let idx = -1;
        const syncedLyrics = state.syncedLyrics;
        for (let i = 0; i < syncedLyrics.length; i++) {
            if (syncedLyrics[i].time <= time && syncedLyrics[i].time !== -1) idx = i;
            else if (syncedLyrics[i].time > time) break;
        }
        if (idx === -1) return;

        const lineObj = syncedLyrics[idx];
        const duration = time - lineObj.time;
        const cfg = state.config.text;
        const fontName = cfg.style === 'serif' ? 'serif' : (cfg.style === 'arcade' ? 'Courier New' : 'Outfit');
        const fontSizeMain = cfg.size * 2;
        const maxWidth = w * 0.7;
        const centerX = w / 2;

        ctx.font = `800 ${fontSizeMain}px "${fontName}"`;
        const mainLines = this.getLines(ctx, lineObj.text, maxWidth);
        const lineHeightMain = fontSizeMain * 1.25;

        // IMPROVED: Advanced styling support per line
        // Calculate overridden values or use defaults
        const transSizePct = lineObj.transSize || cfg.transSizePct || 0.6;
        let fontSizeTrans = fontSizeMain * transSizePct;
        const transFont = lineObj.transFont || cfg.transFont;
        const effectiveTransFont = transFont === 'inherit' ? fontName : transFont;
        const transColor = lineObj.transColor || cfg.transColor;

        let transLines = [];
        if (lineObj.trans) {
            ctx.font = `italic 500 ${fontSizeTrans}px "${effectiveTransFont}"`;
            transLines = this.getLines(ctx, lineObj.trans, maxWidth);
        }

        const lineHeightTrans = fontSizeTrans * 1.4, gap = 40;
        const totalH = (mainLines.length * lineHeightMain) + (transLines.length > 0 ? gap + (transLines.length * lineHeightTrans) : 0);
        let startY = (h / 2) - (totalH / 2) + (lineHeightMain * 0.7);

        let alpha = 1, yAnim = 0, scale = 1, animDur = 0.5;
        if (cfg.animation !== 'typewriter' && duration < animDur) {
            const p = duration / animDur, ease = p * (2 - p);
            if (cfg.animation === 'fade') alpha = ease;
            else if (cfg.animation === 'slide-up') { alpha = ease; yAnim = 80 * (1 - ease); }
            else if (cfg.animation === 'zoom-in') { scale = 0.8 + (0.2 * ease); alpha = ease; }
        }

        ctx.save();

        // Effects handled by registry
        if (lineObj.effect && lineObj.effect !== 'none' && window.EffectsRegistry?.[lineObj.effect]) {
            window.EffectsRegistry[lineObj.effect](ctx, {
                w, h, time, avgVol, scale, duration, alpha,
                fontSizeMain, lineHeightMain, centerX, startY
            });
        }

        ctx.translate(centerX, startY + yAnim); ctx.scale(scale, scale); ctx.globalAlpha = alpha; ctx.textAlign = 'center';
        ctx.font = `800 ${fontSizeMain}px "${fontName}"`;

        // Drawing Main Text
        if (lineObj.effect !== 'flash') {
            if (cfg.style === 'neon') { ctx.shadowColor = cfg.shadow; ctx.shadowBlur = 40; ctx.fillStyle = cfg.color; }
            else if (cfg.style === 'bold') { ctx.strokeStyle = 'black'; ctx.lineWidth = 6; ctx.strokeText(mainLines.join(' '), 0, 0); ctx.fillStyle = cfg.color; }
            else ctx.fillStyle = cfg.color;
        }

        if (lineObj.type === 'karaoke' || lineObj.type === 'instrumental') {
            this.drawKaraokeLine(ctx, lineObj, time, alpha, fontSizeMain, lineHeightMain, maxWidth, cfg);
        } else {
            mainLines.forEach((l, i) => ctx.fillText(l, 0, i * lineHeightMain));
        }

        // Translation with custom styles
        if (transLines.length > 0) {
            ctx.font = `italic 500 ${fontSizeTrans}px "${effectiveTransFont}"`;
            ctx.fillStyle = transColor;
            ctx.shadowColor = cfg.transShadow;
            ctx.shadowBlur = 15;
            const transY = (mainLines.length * lineHeightMain) + gap;
            transLines.forEach((l, i) => ctx.fillText(l, 0, transY + (i * lineHeightTrans)));
        }
        ctx.restore();
    },

    drawKaraokeLine(ctx, lineObj, time, alpha, fontSize, lineHeight, maxWidth, cfg) {
        const syllables = lineObj.syllables || [];
        let karaokeLines = [[]], currentLineIdx = 0, runningWidth = 0;

        syllables.forEach(s => {
            const wordW = ctx.measureText(s.text).width;
            if (runningWidth + wordW > maxWidth && runningWidth > 0) {
                currentLineIdx++; karaokeLines[currentLineIdx] = []; runningWidth = 0;
            }
            karaokeLines[currentLineIdx].push(s);
            runningWidth += wordW;
        });

        const lineOffset = (karaokeLines.length - 1) * lineHeight / 2;
        ctx.textAlign = 'left';
        karaokeLines.forEach((lineSylls, idx) => {
            const lineWidth = ctx.measureText(lineSylls.map(s => s.text).join('')).width;
            let currentX = -lineWidth / 2;
            const lineY = (idx * lineHeight) - lineOffset;

            lineSylls.forEach(s => {
                const wordWidth = ctx.measureText(s.text).width;
                ctx.fillStyle = cfg.color; ctx.globalAlpha = alpha * 0.2;
                ctx.fillText(s.text, currentX, lineY);
                if (time >= s.begin) {
                    ctx.globalAlpha = alpha; ctx.fillStyle = cfg.accent;
                    if (time < s.end) {
                        const p = (time - s.begin) / (s.end - s.begin);
                        ctx.save(); ctx.beginPath(); ctx.rect(currentX, lineY - fontSize, wordWidth * p, fontSize * 2.5);
                        ctx.clip(); ctx.fillText(s.text, currentX, lineY); ctx.restore();
                    } else ctx.fillText(s.text, currentX, lineY);
                }
                currentX += wordWidth;
            });
        });
    },

    drawVisualizer(ctx, w, h, avgVol, state) {
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
    },

    updateParticles(ctx, w, h, avgVol, state) {
        const { particleTheme: theme, particleColor: pColor, particleSize: sizeMult, particleSpeed: vMult } = state.config.text;
        const maxP = (theme === 'fire') ? 150 : (theme === 'stars' ? 100 : 150);

        if (state.particles.length === 0 && theme !== 'none') {
            for (let i = 0; i < maxP; i++) this.spawnParticle(theme, w, h, true, vMult, sizeMult, state);
        }

        if (state.particles.length < maxP) {
            this.spawnParticle(theme, w, h, false, vMult, sizeMult, state);
        }

        ctx.save();
        for (let i = 0; i < state.particles.length; i++) {
            const p = state.particles[i];
            ctx.fillStyle = (theme === 'fire') ? `rgba(255, ${Math.random() * 100}, 0, 0.6)` : pColor;

            if (theme === 'snow') { p.y += p.v; p.x += p.drift; }
            else if (theme === 'fire') { p.y -= p.v; p.x += p.drift; p.s *= 0.98; }
            else if (theme === 'stars') { ctx.globalAlpha = (Math.sin(p.life + Date.now() / 500) + 1) / 2; }
            else { p.y -= p.v; p.x += p.drift; }

            ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();

            if (theme === 'snow' && p.y > h + 100) { state.particles.splice(i, 1); i--; }
            else if (theme === 'stars' && p.y > h) p.y = 0;
            else if (p.y < -100 || (theme === 'fire' && p.s < 1)) { state.particles.splice(i, 1); i--; }
        }
        ctx.restore();
    },

    spawnParticle(type, canvasW, canvasH, randomY, vMult, sizeMult, state) {
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
};

// ============================================================================
// VIDEO EXPORTER - Complete Implementation
// ============================================================================
const VideoExporter = {
    async export(canvas, audio, state, dom, callbacks) {
        await this.exportWebM(canvas, audio, state, dom, callbacks);
    },


    async exportWebM(canvas, audio, state, dom, callbacks) {
        const { showStatus, showError, initAudioContext } = callbacks;

        const startTime = parseFloat(dom['export-start'].value) || 0;
        let endTime = parseFloat(dom['export-end'].value) || audio.duration;
        const fps = state.config.export.fps || 30;

        if (endTime <= startTime) return showError("Fin debe ser mayor que inicio.");

        initAudioContext();
        showStatus("Iniciando exportación WebM de alta calidad...");

        audio.currentTime = startTime;
        if (state.bgType === 'video' && state.backgroundVideo.duration) {
            state.backgroundVideo.currentTime = (startTime + state.config.bg.delay) % state.backgroundVideo.duration;
        }

        const stream = canvas.captureStream(fps);
        const dest = state.audioContext.createMediaStreamDestination();
        state.sourceNode.connect(dest);
        stream.addTrack(dest.stream.getAudioTracks()[0]);

        // IMPROVED: Better codec selection with quality priority
        let mime = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mime)) {
            mime = 'video/webm;codecs=vp8,opus';
        }
        if (!MediaRecorder.isTypeSupported(mime)) {
            mime = 'video/webm';
        }

        // IMPROVED: Higher bitrate for better quality (comparable to MP4)
        const mr = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: 12000000,  // 12 Mbps (higher than before)
            audioBitsPerSecond: 192000     // 192 kbps audio
        });

        const chunks = [];
        mr.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
        mr.onstop = () => {
            const blob = new Blob(chunks, { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const filename = state.config.meta.song || 'video';
            a.download = `${filename.replace(/\s+/g, '-')}.webm`;
            a.click();
            showStatus("¡WebM Exportado con éxito!");
            if (callbacks.onComplete) callbacks.onComplete();
        };

        mr.start(100); // Capture in 100ms chunks for smoother recording
        audio.play();
        if (state.bgType === 'video') state.backgroundVideo.play();

        // IMPROVED: Better progress tracking
        const duration = endTime - startTime;
        audio.ontimeupdate = () => {
            const elapsed = audio.currentTime - startTime;
            const progress = (elapsed / duration) * 100;
            showStatus(`Exportando WebM: ${progress.toFixed(1)}% (${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s)`);

            if (audio.currentTime >= endTime) {
                audio.pause();
                mr.stop();
                audio.ontimeupdate = null;
                if (state.bgType === 'video') state.backgroundVideo.pause();
            }
        };
    }
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================
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

    isSyncing: false,
    needsRender: true,
    isExporting: false,
    isPlayingAudio: false,

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
        logo: { x: 50, y: 75, scale: 0.5, opacity: 1.0 },
        fx: { particles: false, vignette: false, grain: false },
        export: { fps: 30 }
    },

    canvas: null,
    ctx: null,
    particles: [],
    bandLogoImage: null,
    popup: { window: null, canvas: null, ctx: null },
    lyricType: 'text',
    lastVideoSyncTime: 0,  // NEW: Track last video sync to prevent excessive seeking
    backgroundCache: {
        canvas: document.createElement('canvas'),
        needsUpdate: true,
        blur: -1
    }
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
        'progress-track', 'time-code', 'apple-lyrics-input', 'apple-trans-editor',
        'band-logo-upload', 'band-logo-name', 'logo-scale', 'val-logo-scale', 'logo-x', 'val-logo-x',
        'logo-y', 'val-logo-y', 'logo-opacity', 'val-logo-opacity', 'val-wm-opacity', 'export-fps', 'export-format'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) dom[id] = el;
    });

    state.canvas = dom['video-canvas'];
    state.ctx = state.canvas.getContext('2d');
    state.audio.crossOrigin = "anonymous";

    // IMPROVED: Configure background video for better sync
    state.backgroundVideo.loop = true;
    state.backgroundVideo.muted = true;
    state.backgroundVideo.crossOrigin = "anonymous";
    state.backgroundVideo.preload = "auto";  // Ensure video is fully loaded
    state.backgroundVideo.playbackRate = 1.0;  // Ensure normal playback rate

    setupTabs();
    setupStyleSelectors();
    setupEvents();
    setupPresets();

    // Recovery Logic
    const saved = localStorage.getItem('desko_autosave');
    if (saved) {
        if (confirm("Se detectó un proyecto guardado. ¿Deseas recuperarlo?")) {
            const data = JSON.parse(saved);
            state.syncedLyrics = data.syncedLyrics;
            state.lyricType = data.lyricType;
            Object.assign(state.config, data.config);
            syncUIWithConfig();
            showStatus("Proyecto recuperado");
        }
    }

    // AutoSave Timer (Every 30s)
    setInterval(saveToLocalStorage, 30000);


    requestAnimationFrame(loop);

    console.log('DESKOEDITOR V1 initialized successfully!');

    // Expose globals for AdvancedEditor
    window.appState = state;
    window.appDom = dom;
    window.appCallbacks = { showStatus, showError, initAudioContext };
}


function saveToLocalStorage() {
    const data = {
        syncedLyrics: state.syncedLyrics,
        config: state.config,
        lyricType: state.lyricType
    };
    localStorage.setItem('desko_autosave', JSON.stringify(data));
    showStatus("Proyecto autoguardado");
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

            // IMPROVED: Wait for video to be ready before playing
            state.backgroundVideo.addEventListener('loadedmetadata', () => {
                console.log('Video loaded, duration:', state.backgroundVideo.duration);
                showStatus("Video de fondo cargado");
                state.needsRender = true;
            }, { once: true });

            state.backgroundVideo.load();
        } else {
            const img = new Image();
            img.onload = () => {
                state.backgroundImage = img;
                state.bgType = 'image';
                state.backgroundCache.needsUpdate = true;
                showStatus("Imagen cargada");
                state.needsRender = true;
            };
            img.src = url;
        }
    });

    // Config Inputs
    const updateConfig = () => {
        if (!dom['bg-blur']) return;
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
        if (dom['val-wm-opacity']) dom['val-wm-opacity'].innerText = dom['wm-opacity'].value + '%';

        state.config.logo.scale = parseInt(dom['logo-scale'].value) / 100;
        state.config.logo.x = parseInt(dom['logo-x'].value);
        state.config.logo.y = parseInt(dom['logo-y'].value);
        state.config.logo.opacity = parseInt(dom['logo-opacity'].value) / 100;

        if (dom['val-logo-scale']) dom['val-logo-scale'].innerText = dom['logo-scale'].value + '%';
        if (dom['val-logo-x']) dom['val-logo-x'].innerText = dom['logo-x'].value + '%';
        if (dom['val-logo-y']) dom['val-logo-y'].innerText = dom['logo-y'].value + '%';
        if (dom['val-logo-opacity']) dom['val-logo-opacity'].innerText = dom['logo-opacity'].value + '%';

        state.config.export.fps = parseInt(dom['export-fps'].value);

        state.config.fx.particles = dom['fx-particles'].checked;
        state.config.fx.vignette = dom['fx-vignette'].checked;
        state.config.fx.grain = dom['fx-grain'].checked;
        state.backgroundCache.needsUpdate = true;
        state.needsRender = true;
    };

    const inputIds = ['bg-blur', 'bg-darken', 'bg-scale', 'bg-delay', 'beat-intensity', 'text-animation',
        'text-color', 'accent-color', 'shadow-color', 'font-size', 'trans-color', 'trans-accent',
        'trans-shadow', 'trans-font', 'trans-size', 'particle-color', 'particle-theme', 'particle-size',
        'particle-speed', 'meta-artist', 'meta-song', 'wm-opacity', 'viz-style', 'viz-color',
        'logo-scale', 'logo-x', 'logo-y', 'logo-opacity', 'export-fps', 'export-format'];

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
        if (state.bgType === 'video') {
            state.backgroundVideo.currentTime = 0;
            state.backgroundVideo.play();
        }
        state.isPlayingAudio = true;
    });

    dom['export-btn'].addEventListener('click', () => {
        VideoExporter.export(state.canvas, state.audio, state, dom, {
            showStatus, showError, initAudioContext,
            onComplete: () => { state.isExporting = false; }
        });
        state.isExporting = true;
    });

    // IMPROVED: Better seeking with immediate video sync
    let isDragging = false;
    const handleSeek = (e) => {
        if (!state.audio.duration) return;
        const rect = dom['progress-track'].getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seekTime = percent * state.audio.duration;
        state.audio.currentTime = seekTime;

        // IMPROVED: Immediate and precise background video sync on seek
        if (state.bgType === 'video' && state.backgroundVideo.duration) {
            const targetTime = (seekTime + state.config.bg.delay) % state.backgroundVideo.duration;
            state.backgroundVideo.currentTime = targetTime < 0 ? 0 : targetTime;
            state.lastVideoSyncTime = Date.now();  // Mark that we just synced
        }
        state.needsRender = true;
    };

    dom['progress-track'].addEventListener('mousedown', (e) => {
        isDragging = true;
        handleSeek(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) handleSeek(e);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    dom['progress-track'].addEventListener('click', handleSeek);

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

    // Band Logo Upload
    dom['band-logo-upload']?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file?.type.startsWith('image/')) return showError("Imagen no válida");

        if (state.bandLogoImage?.src.startsWith('blob:')) URL.revokeObjectURL(state.bandLogoImage.src);

        const img = new Image();
        img.onload = () => { state.bandLogoImage = img; showStatus("Logo de banda cargado"); state.needsRender = true; };
        img.src = URL.createObjectURL(file);
        dom['band-logo-name'].textContent = file.name;
    });

    // Watermark
    dom['watermark-upload'].addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file?.type.startsWith('image/')) return showError("Imagen no válida");

        if (state.watermarkImage?.src.startsWith('blob:')) URL.revokeObjectURL(state.watermarkImage.src);

        const img = new Image();
        img.onload = () => { state.watermarkImage = img; showStatus("Sello cargado"); state.needsRender = true; };
        img.src = URL.createObjectURL(file);
        dom['wm-file-name'].textContent = file.name;
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

// IMPROVED: Optimized render loop with better video sync
function loop() {
    requestAnimationFrame(loop);

    // Always render when playing or syncing for smooth video playback
    if (!(state.isPlayingAudio || state.isSyncing || state.needsRender || state.isExporting)) return;

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

// IMPROVED: Much better video synchronization
function syncBackgroundVideo(now) {
    if (state.bgType !== 'video' || !state.backgroundVideo.duration) return;

    const targetTime = (now + state.config.bg.delay) % state.backgroundVideo.duration;
    const actualTime = state.backgroundVideo.currentTime;
    const diff = Math.abs(targetTime - actualTime);

    // IMPROVED: Adaptive threshold - tighter sync when not recently seeked
    const timeSinceLastSync = Date.now() - state.lastVideoSyncTime;
    const threshold = timeSinceLastSync < 500 ? 0.5 : 0.2;  // Looser right after seek, then tighter

    if (diff > threshold) {
        state.backgroundVideo.currentTime = targetTime < 0 ? 0 : targetTime;
        state.lastVideoSyncTime = Date.now();
    }

    // Sync playback state
    if (state.isPlayingAudio && state.backgroundVideo.paused) {
        state.backgroundVideo.play().catch(() => { });
    } else if (!state.isPlayingAudio && !state.backgroundVideo.paused) {
        state.backgroundVideo.pause();
    }
}

function updateUIPos(now) {
    if (state.audio.duration) {
        dom['progress-fill'].style.width = (now / state.audio.duration * 100) + '%';
        const mins = Math.floor(now / 60), secs = Math.floor(now % 60);
        dom['time-code'].textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

function updateBackgroundCache(w, h, blur) {
    const cache = state.backgroundCache;
    cache.canvas.width = w;
    cache.canvas.height = h;
    const cctx = cache.canvas.getContext('2d');
    RenderEngine.drawCover(cctx, state.backgroundImage, w, h, blur);
    cache.needsUpdate = false;
    cache.blur = blur;
}

function renderFrame(time, avgVol) {
    const { canvas: cvs, ctx, config: cfg } = state;
    const { width: w, height: h } = cvs;

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);

    let scale = cfg.bg.scale + (cfg.bg.reactive ? (avgVol / 255) * (cfg.bg.intensity / 100) * 0.2 : 0);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2);

    if (state.bgType === 'image' && state.backgroundImage) {
        if (state.backgroundCache.needsUpdate || state.backgroundCache.blur !== cfg.bg.blur) {
            updateBackgroundCache(w, h, cfg.bg.blur);
        }
        ctx.drawImage(state.backgroundCache.canvas, 0, 0);
    } else if (state.bgType === 'video') {
        RenderEngine.drawCover(ctx, state.backgroundVideo, w, h, cfg.bg.blur);
    }
    ctx.restore();

    if (cfg.bg.darken > 0) { ctx.fillStyle = `rgba(0,0,0, ${cfg.bg.darken / 100})`; ctx.fillRect(0, 0, w, h); }
    if (cfg.fx.grain) RenderEngine.drawGrain(ctx, w, h);
    if (cfg.fx.vignette) RenderEngine.drawVignette(ctx, w, h);
    if (cfg.viz.style !== 'none') RenderEngine.drawVisualizer(ctx, w, h, avgVol, state);
    if (cfg.fx.particles) RenderEngine.updateParticles(ctx, w, h, avgVol, state);

    RenderEngine.drawLyricsBlock(ctx, w, h, time, avgVol, state);
    RenderEngine.drawMetadata(ctx, w, h, cfg.meta);
    if (state.bandLogoImage) RenderEngine.drawBandLogo(ctx, w, h, state.bandLogoImage, cfg.logo);
    if (state.watermarkImage) RenderEngine.drawWatermark(ctx, w, h, state.watermarkImage, cfg.watermark.opacity);

    // Sync to OBS Popup if open
    if (state.popup.ctx) {
        state.popup.ctx.drawImage(cvs, 0, 0);
    }
}

function togglePlay() {
    initAudioContext();
    if (state.isPlayingAudio) {
        state.audio.pause(); state.backgroundVideo.pause(); state.isPlayingAudio = false;
        dom['play-pause-btn'].innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
        state.audio.play();
        if (state.bgType === 'video') state.backgroundVideo.play();
        state.isPlayingAudio = true;
        dom['play-pause-btn'].innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
}

function startSync() {
    initAudioContext(); state.isSyncing = true; state.audio.currentTime = 0; state.audio.play(); state.isPlayingAudio = true;
    dom['sync-overlay'].classList.remove('hidden'); updateSyncUI();
}

function handleTap() {
    if (!state.isSyncing) return;
    const idx = state.syncedLyrics.findIndex(l => l.time === -1);
    if (idx !== -1) { state.syncedLyrics[idx].time = state.audio.currentTime; updateSyncUI(); }
}

function endSync() {
    state.isSyncing = false; dom['sync-overlay'].classList.add('hidden');
    state.audio.pause(); state.isPlayingAudio = false; renderTimelineEditor();
}

function showStatus(msg) { dom['status-msg'].textContent = msg; dom['status-msg'].style.color = 'var(--primary)'; }
function showError(msg) { dom['status-msg'].textContent = msg; dom['status-msg'].style.color = '#ff4d4d'; }

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
    // Use the new Advanced Editor instead of the old one
    if (typeof AdvancedEditor !== 'undefined') {
        AdvancedEditor.renderAdvancedAppleEditor(state, dom, { showStatus, showError });
    } else {
        console.error('AdvancedEditor not loaded');
        // Fallback to basic editor if advanced editor fails to load
        renderBasicAppleEditor();
    }
}

function renderBasicAppleEditor() {
    // Fallback basic editor (original implementation)
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
