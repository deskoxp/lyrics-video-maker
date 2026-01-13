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
        editor.className = 'instrumental-editor minimal';
        editor.innerHTML = `
            <div class="instrumental-icon small">🎵 Instrumental</div>
            <div class="time-minimal">
                <input type="number" step="0.1" value="${line.time.toFixed(1)}" 
                       onchange="AdvancedEditor.updateLineTime(${index}, 'time', this.value)">
                <span>a</span>
                <input type="number" step="0.1" value="${(line.endTime || line.time + 3).toFixed(1)}" 
                       onchange="AdvancedEditor.updateLineTime(${index}, 'endTime', this.value)">
            </div>
        `;
        return editor;
    },


    createLyricEditor(line, index, state, callbacks) {
        const editor = document.createElement('div');
        editor.className = 'lyric-editor minimal';

        // Compact Text Section
        const textSection = document.createElement('div');
        textSection.className = 'compact-text-section';
        textSection.innerHTML = `
            <div class="input-pair">
                <textarea class="lyric-textarea small original-text" 
                          placeholder="Texto Original..."
                          onchange="AdvancedEditor.updateOriginalText(${index}, this.value)">${line.text || ''}</textarea>
                <textarea class="lyric-textarea small translation-text" 
                          placeholder="Traducción..."
                          onchange="AdvancedEditor.updateTranslation(${index}, this.value)">${line.trans || ''}</textarea>
            </div>
        `;
        editor.appendChild(textSection);

        // Minimal Controls Row
        const controlsRow = document.createElement('div');
        controlsRow.className = 'minimal-controls-row';
        controlsRow.innerHTML = `
            <div class="control-item">
                <label><i class="fa-solid fa-sparkles"></i></label>
                <select class="minimal-select" onchange="AdvancedEditor.setEffect(${index}, this.value)">
                    <option value="none" ${!line.effect || line.effect === 'none' ? 'selected' : ''}>Sin Efecto</option>
                    <option value="pulse" ${line.effect === 'pulse' ? 'selected' : ''}>Pulse</option>
                    <option value="glitch" ${line.effect === 'glitch' ? 'selected' : ''}>Glitch</option>
                    <option value="flash" ${line.effect === 'flash' ? 'selected' : ''}>Flash</option>
                    <option value="neon_flicker" ${line.effect === 'neon_flicker' ? 'selected' : ''}>Neon</option>
                    <option value="rainbow" ${line.effect === 'rainbow' ? 'selected' : ''}>Rainbow</option>
                    <option value="shake" ${line.effect === 'shake' ? 'selected' : ''}>Shake</option>
                    <option value="floating" ${line.effect === 'floating' ? 'selected' : ''}>Floating</option>
                </select>
            </div>
            <div class="control-item">
                <label>Pts</label>
                <select class="minimal-select" onchange="AdvancedEditor.updateLineStyle(${index}, 'transSize', this.value)">
                    <option value="0.4" ${line.transSize === 0.4 ? 'selected' : ''}>40%</option>
                    <option value="0.5" ${line.transSize === 0.5 ? 'selected' : ''}>50%</option>
                    <option value="0.6" ${!line.transSize || line.transSize === 0.6 ? 'selected' : ''}>60%</option>
                    <option value="0.8" ${line.transSize === 0.8 ? 'selected' : ''}>80%</option>
                    <option value="1.0" ${line.transSize === 1.0 ? 'selected' : ''}>100%</option>
                </select>
            </div>
            <div class="control-item">
                <input type="color" class="minimal-color" value="${line.transColor || '#f472b6'}" 
                       onchange="AdvancedEditor.updateLineStyle(${index}, 'transColor', this.value)">
            </div>
            <div class="control-item time-minimal">
                <input type="number" step="0.1" value="${line.time.toFixed(1)}" 
                       onchange="AdvancedEditor.updateLineTime(${index}, 'time', this.value)">
                <span>a</span>
                <input type="number" step="0.1" value="${(line.endTime || line.time + 3).toFixed(1)}" 
                       onchange="AdvancedEditor.updateLineTime(${index}, 'endTime', this.value)">
            </div>
            <button class="icon-btn-small" onclick="AdvancedEditor.setToCurrentTime(${index})" title="Tiempo Actual">
                <i class="fa-solid fa-clock"></i>
            </button>
        `;
        editor.appendChild(controlsRow);

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
