/**
 * DESKOEDITOR V1 - Video Exporter
 * Gestiona el MediaRecorder y la generación del archivo final.
 */

export const VideoExporter = {
    async export(canvas, audio, state, dom, callbacks) {
        const { showStatus, showError, initAudioContext } = callbacks;

        const startTime = parseFloat(dom['export-start'].value) || 0;
        let endTime = parseFloat(dom['export-end'].value) || audio.duration;

        if (endTime <= startTime) return showError("El tiempo de fin debe ser mayor al de inicio.");

        initAudioContext();
        const exportStartRealTime = Date.now();

        audio.currentTime = startTime;
        if (state.bgType === 'video' && state.backgroundVideo.duration) {
            state.backgroundVideo.currentTime = (startTime + state.config.bg.delay) % state.backgroundVideo.duration;
        }

        const stream = canvas.captureStream(60);
        const dest = state.audioContext.createMediaStreamDestination();
        state.sourceNode.connect(dest);
        state.sourceNode.disconnect(state.analyser);
        state.sourceNode.connect(state.analyser);
        stream.addTrack(dest.stream.getAudioTracks()[0]);

        let mime = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mime)) return showError("Tu navegador no soporta grabación de video.");

        try {
            const mr = new MediaRecorder(stream, {
                mimeType: mime,
                videoBitsPerSecond: 12000000,
                audioBitsPerSecond: 256000
            });
            const chunks = [];

            mr.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);

            mr.onstop = () => {
                if (chunks.length === 0) return showError("Error: No se capturaron datos.");
                const url = URL.createObjectURL(new Blob(chunks, { type: mime }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(state.config.meta.song || 'video').replace(/\s+/g, '-')}.webm`;
                a.click();
                showStatus("¡Exportado!");
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                if (callbacks.onComplete) callbacks.onComplete();
            };

            mr.onerror = (err) => {
                showError("Error durante la grabación.");
                if (callbacks.onComplete) callbacks.onComplete();
            };

            mr.start();
            audio.play();
            if (state.bgType === 'video') state.backgroundVideo.play();

            audio.ontimeupdate = () => {
                const progress = (audio.currentTime - startTime) / (endTime - startTime);
                const elapsed = (Date.now() - exportStartRealTime) / 1000;
                const estimatedTotal = elapsed / progress;
                const remaining = Math.max(0, estimatedTotal - elapsed);

                showStatus(`Renderizando: ${(progress * 100).toFixed(1)}% | Quedan: ${Math.round(remaining)}s`);

                if (audio.currentTime >= endTime) {
                    audio.pause();
                    mr.stop();
                    audio.ontimeupdate = null;
                }
            };
        } catch (e) {
            showError("No se pudo iniciar la grabadora.");
            if (callbacks.onComplete) callbacks.onComplete();
        }
    }
};
