/**
 * DESKOEDITOR V1 - Render Engine
 * Maneja todo el dibujo en el canvas y efectos visuales.
 */

export const RenderEngine = {
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

        // Config.x and y are in percentage (0-100)
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

        let transLines = [], fontSizeTrans = fontSizeMain * (cfg.transSizePct || 0.6);
        if (lineObj.trans) {
            ctx.font = `italic 500 ${fontSizeTrans}px "${cfg.transFont === 'inherit' ? fontName : cfg.transFont}"`;
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

        // Translation
        if (transLines.length > 0) {
            ctx.font = `italic 500 ${fontSizeTrans}px "${cfg.transFont === 'inherit' ? fontName : cfg.transFont}"`;
            ctx.fillStyle = cfg.transColor;
            ctx.shadowColor = cfg.transShadow;
            ctx.shadowBlur = 15;
            const transY = (mainLines.length * lineHeightMain) + gap;
            transLines.forEach((l, i) => ctx.fillText(l, 0, transY + (i * lineHeightTrans)));
        }
        ctx.restore();
    },

    drawKaraokeLine(ctx, lineObj, time, alpha, fontSize, lineHeight, maxWidth, cfg) {
        // Karaoke logic extracted here
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
