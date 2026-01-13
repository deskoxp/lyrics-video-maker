/**
 * DESKOEDITOR V1 - Advanced Apple Music Editor
 * Editor avanzado para letras de Apple Music con efectos por palabra/frase
 */

const AdvancedEditor = {
    currentEditingLine: null,

    renderAdvancedAppleEditor(state, dom, callbacks) {
        const container = dom['apple-trans-editor'];
        if (!container) return;

        container.innerHTML = `
            <div class="advanced-editor-header">
                <h4 style="margin: 0.5rem 0; font-size: 0.9rem; color: var(--primary);">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Editor Avanzado de Karaoke
                </h4>
                <p style="font-size: 0.7rem; color: var(--text-muted); margin: 0.25rem 0;">
                    Edita letra original, traducciones y efectos por línea
                </p>
            </div>
        `;

        state.syncedLyrics.forEach((line, index) => {
            // Add instrumental button between lines
            if (index > 0 && line.type !== 'instrumental' && state.syncedLyrics[index - 1].type !== 'instrumental') {
                const addBtn = document.createElement('button');
                addBtn.className = 'add-instrumental-btn';
                addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir Pausa Instrumental';
                addBtn.onclick = () => this.injectInstrumental(index, state, dom, callbacks);
                container.appendChild(addBtn);
            }

            const lineCard = this.createLineCard(line, index, state, callbacks);
            container.appendChild(lineCard);
        });
    },

    createLineCard(line, index, state, callbacks) {
        const card = document.createElement('div');
        card.className = `advanced-line-card ${line.type === 'instrumental' ? 'instrumental' : ''}`;
        card.dataset.index = index;

        // Header with controls
        const header = document.createElement('div');
        header.className = 'line-card-header';
        header.innerHTML = `
            <div class="line-number">#${index + 1}</div>
            <div class="line-time">${this.formatTime(line.time)} - ${this.formatTime(line.endTime || line.time + 3)}</div>
            <div class="line-actions">
                <button class="icon-btn" title="Duplicar línea" onclick="AdvancedEditor.duplicateLine(${index})">
                    <i class="fa-solid fa-copy"></i>
                </button>
                <button class="icon-btn" title="Mover arriba" onclick="AdvancedEditor.moveLine(${index}, -1)" ${index === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button class="icon-btn" title="Mover abajo" onclick="AdvancedEditor.moveLine(${index}, 1)" ${index === state.syncedLyrics.length - 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-down"></i>
                </button>
                <button class="icon-btn danger" title="Eliminar línea" onclick="AdvancedEditor.deleteLine(${index})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        card.appendChild(header);

        if (line.type === 'instrumental') {
            card.appendChild(this.createInstrumentalEditor(line, index, state));
        } else {
            card.appendChild(this.createLyricEditor(line, index, state, callbacks));
        }

        return card;
    },

    createInstrumentalEditor(line, index, state) {
        const editor = document.createElement('div');
        editor.className = 'instrumental-editor';
        editor.innerHTML = `
            <div class="instrumental-icon">🎵</div>
            <div class="time-controls">
                <div class="time-input-group">
                    <label>Inicio (s)</label>
                    <input type="number" step="0.1" value="${line.time.toFixed(2)}" 
                           onchange="AdvancedEditor.updateLineTime(${index}, 'time', this.value)">
                </div>
                <div class="time-input-group">
                    <label>Fin (s)</label>
                    <input type="number" step="0.1" value="${(line.endTime || line.time + 3).toFixed(2)}" 
                           onchange="AdvancedEditor.updateLineTime(${index}, 'endTime', this.value)">
                </div>
            </div>
        `;
        return editor;
    },

    createLyricEditor(line, index, state, callbacks) {
        const editor = document.createElement('div');
        editor.className = 'lyric-editor';

        // Original lyrics (English) - Editable
        const originalSection = document.createElement('div');
        originalSection.className = 'lyric-section original';
        originalSection.innerHTML = `
            <label class="section-label">
                <i class="fa-solid fa-language"></i> Letra Original (Inglés)
            </label>
            <textarea class="lyric-textarea original-text" 
                      placeholder="Letra original en inglés..."
                      onchange="AdvancedEditor.updateOriginalText(${index}, this.value)">${line.text || ''}</textarea>
        `;
        editor.appendChild(originalSection);

        // Translation - Editable with more options
        const translationSection = document.createElement('div');
        translationSection.className = 'lyric-section translation';
        translationSection.innerHTML = `
            <label class="section-label">
                <i class="fa-solid fa-globe"></i> Traducción (Español)
            </label>
            <textarea class="lyric-textarea translation-text" 
                      placeholder="Traducción al español..."
                      onchange="AdvancedEditor.updateTranslation(${index}, this.value)">${line.trans || ''}</textarea>
            
            <div class="translation-options">
                <div class="option-group">
                    <label>Tamaño</label>
                    <select onchange="AdvancedEditor.updateLineStyle(${index}, 'transSize', this.value)">
                        <option value="0.4" ${line.transSize === 0.4 ? 'selected' : ''}>40%</option>
                        <option value="0.5" ${line.transSize === 0.5 ? 'selected' : ''}>50%</option>
                        <option value="0.6" ${!line.transSize || line.transSize === 0.6 ? 'selected' : ''}>60% (Default)</option>
                        <option value="0.7" ${line.transSize === 0.7 ? 'selected' : ''}>70%</option>
                        <option value="0.8" ${line.transSize === 0.8 ? 'selected' : ''}>80%</option>
                        <option value="1.0" ${line.transSize === 1.0 ? 'selected' : ''}>100%</option>
                    </select>
                </div>
                <div class="option-group">
                    <label>Color</label>
                    <input type="color" value="${line.transColor || '#f472b6'}" 
                           onchange="AdvancedEditor.updateLineStyle(${index}, 'transColor', this.value)">
                </div>
                <div class="option-group">
                    <label>Fuente</label>
                    <select onchange="AdvancedEditor.updateLineStyle(${index}, 'transFont', this.value)">
                        <option value="inherit" ${!line.transFont || line.transFont === 'inherit' ? 'selected' : ''}>Igual a principal</option>
                        <option value="Outfit" ${line.transFont === 'Outfit' ? 'selected' : ''}>Outfit</option>
                        <option value="serif" ${line.transFont === 'serif' ? 'selected' : ''}>Serif</option>
                        <option value="Courier New" ${line.transFont === 'Courier New' ? 'selected' : ''}>Mono</option>
                        <option value="cursive" ${line.transFont === 'cursive' ? 'selected' : ''}>Cursiva</option>
                    </select>
                </div>
            </div>
        `;
        editor.appendChild(translationSection);

        // Effects section
        const effectsSection = document.createElement('div');
        effectsSection.className = 'lyric-section effects';
        effectsSection.innerHTML = `
            <label class="section-label">
                <i class="fa-solid fa-sparkles"></i> Efectos Visuales
            </label>
            <div class="effects-grid">
                <div class="effect-option ${!line.effect || line.effect === 'none' ? 'active' : ''}" 
                     onclick="AdvancedEditor.setEffect(${index}, 'none')">
                    <i class="fa-solid fa-ban"></i>
                    <span>Sin efecto</span>
                </div>
                <div class="effect-option ${line.effect === 'pulse' ? 'active' : ''}" 
                     onclick="AdvancedEditor.setEffect(${index}, 'pulse')">
                    <i class="fa-solid fa-heart-pulse"></i>
                    <span>Pulse</span>
                </div>
                <div class="effect-option ${line.effect === 'glitch' ? 'active' : ''}" 
                     onclick="AdvancedEditor.setEffect(${index}, 'glitch')">
                    <i class="fa-solid fa-bolt"></i>
                    <span>Glitch</span>
                </div>
                <div class="effect-option ${line.effect === 'flash' ? 'active' : ''}" 
                     onclick="AdvancedEditor.setEffect(${index}, 'flash')">
                    <i class="fa-solid fa-sun"></i>
                    <span>Flash</span>
                </div>
                <div class="effect-option ${line.effect === 'neon_flicker' ? 'active' : ''}" 
                     onclick="AdvancedEditor.setEffect(${index}, 'neon_flicker')">
                    <i class="fa-solid fa-lightbulb"></i>
                    <span>Neon</span>
                </div>
                <div class="effect-option ${line.effect === 'rainbow' ? 'active' : ''}" 
                     onclick="AdvancedEditor.setEffect(${index}, 'rainbow')">
                    <i class="fa-solid fa-rainbow"></i>
                    <span>Rainbow</span>
                </div>
                <div class="effect-option ${line.effect === 'shake' ? 'active' : ''}" 
                     onclick="AdvancedEditor.setEffect(${index}, 'shake')">
                    <i class="fa-solid fa-earthquake"></i>
                    <span>Shake</span>
                </div>
                <div class="effect-option ${line.effect === 'floating' ? 'active' : ''}" 
                     onclick="AdvancedEditor.setEffect(${index}, 'floating')">
                    <i class="fa-solid fa-cloud"></i>
                    <span>Floating</span>
                </div>
            </div>
        `;
        editor.appendChild(effectsSection);

        // Timing controls
        const timingSection = document.createElement('div');
        timingSection.className = 'lyric-section timing';
        timingSection.innerHTML = `
            <label class="section-label">
                <i class="fa-solid fa-clock"></i> Sincronización
            </label>
            <div class="timing-controls">
                <div class="time-input-group">
                    <label>Inicio (s)</label>
                    <input type="number" step="0.1" value="${line.time.toFixed(2)}" 
                           onchange="AdvancedEditor.updateLineTime(${index}, 'time', this.value)">
                </div>
                <div class="time-input-group">
                    <label>Fin (s)</label>
                    <input type="number" step="0.1" value="${(line.endTime || line.time + 3).toFixed(2)}" 
                           onchange="AdvancedEditor.updateLineTime(${index}, 'endTime', this.value)">
                </div>
                <button class="btn-small" onclick="AdvancedEditor.setToCurrentTime(${index})">
                    <i class="fa-solid fa-crosshairs"></i> Usar tiempo actual
                </button>
            </div>
        `;
        editor.appendChild(timingSection);

        return editor;
    },

    // Helper methods
    formatTime(seconds) {
        if (!seconds || seconds < 0) return '00:00.0';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        return `${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
    },

    // Action methods (these will be called from onclick handlers)
    updateOriginalText(index, value) {
        const state = window.appState || state;
        if (state.syncedLyrics[index]) {
            state.syncedLyrics[index].text = value;
            state.needsRender = true;
        }
    },

    updateTranslation(index, value) {
        const state = window.appState || state;
        if (state.syncedLyrics[index]) {
            state.syncedLyrics[index].trans = value;
            state.needsRender = true;
        }
    },

    updateLineStyle(index, property, value) {
        const state = window.appState || state;
        if (state.syncedLyrics[index]) {
            state.syncedLyrics[index][property] = property.includes('Size') ? parseFloat(value) : value;
            state.needsRender = true;
        }
    },

    updateLineTime(index, property, value) {
        const state = window.appState || state;
        if (state.syncedLyrics[index]) {
            state.syncedLyrics[index][property] = parseFloat(value);
            state.needsRender = true;
        }
    },

    setEffect(index, effectName) {
        const state = window.appState || state;
        if (state.syncedLyrics[index]) {
            state.syncedLyrics[index].effect = effectName;
            state.needsRender = true;
            // Re-render to update UI
            const dom = window.appDom || dom;
            const callbacks = window.appCallbacks || {};
            this.renderAdvancedAppleEditor(state, dom, callbacks);
        }
    },

    duplicateLine(index) {
        const state = window.appState || state;
        const line = JSON.parse(JSON.stringify(state.syncedLyrics[index]));
        line.time = line.endTime || line.time + 3;
        line.endTime = line.time + 3;
        state.syncedLyrics.splice(index + 1, 0, line);
        const dom = window.appDom || dom;
        const callbacks = window.appCallbacks || {};
        this.renderAdvancedAppleEditor(state, dom, callbacks);
    },

    moveLine(index, direction) {
        const state = window.appState || state;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= state.syncedLyrics.length) return;

        [state.syncedLyrics[index], state.syncedLyrics[newIndex]] =
            [state.syncedLyrics[newIndex], state.syncedLyrics[index]];

        const dom = window.appDom || dom;
        const callbacks = window.appCallbacks || {};
        this.renderAdvancedAppleEditor(state, dom, callbacks);
    },

    deleteLine(index) {
        if (!confirm('¿Eliminar esta línea?')) return;
        const state = window.appState || state;
        state.syncedLyrics.splice(index, 1);
        const dom = window.appDom || dom;
        const callbacks = window.appCallbacks || {};
        this.renderAdvancedAppleEditor(state, dom, callbacks);
    },

    setToCurrentTime(index) {
        const state = window.appState || state;
        const audio = state.audio;
        if (state.syncedLyrics[index] && audio) {
            state.syncedLyrics[index].time = audio.currentTime;
            const dom = window.appDom || dom;
            const callbacks = window.appCallbacks || {};
            this.renderAdvancedAppleEditor(state, dom, callbacks);
        }
    },

    injectInstrumental(index, state, dom, callbacks) {
        const start = state.syncedLyrics[index - 1].endTime || state.syncedLyrics[index - 1].time;
        const end = state.syncedLyrics[index].time;
        state.syncedLyrics.splice(index, 0, {
            text: '🎵', trans: '', time: start, endTime: end, type: 'instrumental',
            syllables: [{ text: '🎵', begin: start, end: end }]
        });
        this.renderAdvancedAppleEditor(state, dom, callbacks);
    }
};

// Make it globally available
window.AdvancedEditor = AdvancedEditor;
