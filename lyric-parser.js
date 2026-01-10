/**
 * DESKOEDITOR V1 - Lyric Parser
 * Procesa formatos LRC y Apple Music JSON.
 */

export const LyricParser = {
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
