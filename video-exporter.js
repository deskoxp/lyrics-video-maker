/**
 * DESKOEDITOR V1 - Flexible Video Exporter
 * Soporta MP4 (WebCodecs) y WebM (MediaRecorder)
 */

/* global Mp4Muxer */

export const VideoExporter = {
    async export(canvas, audio, state, dom, callbacks) {
        const format = state.config.export.format || 'mp4';

        if (format === 'mp4') {
            await this.exportMP4(canvas, audio, state, dom, callbacks);
        } else {
            await this.exportWebM(canvas, audio, state, dom, callbacks);
        }
    },

    async exportMP4(canvas, audio, state, dom, callbacks) {
        const { showStatus, showError, initAudioContext } = callbacks;
        try {
            if (!window.VideoEncoder || !window.AudioEncoder) {
                throw new Error("WebCodecs no soportado. Usa Chrome o Edge.");
            }

            const startTime = parseFloat(dom['export-start'].value) || 0;
            let endTime = parseFloat(dom['export-end'].value) || audio.duration;
            const fps = state.config.export.fps || 30;

            if (endTime <= startTime) return showError("Fin debe ser mayor que inicio.");

            initAudioContext();
            showStatus("Configurando codificadores...");

            const muxer = new Mp4Muxer.Muxer({
                target: new Mp4Muxer.ArrayBufferTarget(),
                video: {
                    codec: 'avc1.42E01E',
                    width: canvas.width,
                    height: canvas.height
                },
                audio: {
                    codec: 'mp4a.40.2',
                    numberOfChannels: 2,
                    sampleRate: state.audioContext.sampleRate
                },
                fastStart: 'fragmented'
            });

            const videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: (e) => {
                    console.error("VideoEncoder Error:", e);
                    showError("Error Video: " + e.message);
                }
            });

            videoEncoder.configure({
                codec: 'avc1.42E01E',
                width: canvas.width,
                height: canvas.height,
                bitrate: 8_000_000,
                framerate: fps
            });

            const audioEncoder = new AudioEncoder({
                output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                error: (e) => {
                    console.error("AudioEncoder Error:", e);
                    showError("Error Audio: " + e.message);
                }
            });

            audioEncoder.configure({
                codec: 'mp4a.40.2',
                numberOfChannels: 2,
                sampleRate: state.audioContext.sampleRate,
                bitrate: 128_000
            });

            // Preparar Audio Stream
            let reader = null;
            try {
                const dest = state.audioContext.createMediaStreamDestination();
                state.sourceNode.connect(dest);
                const track = dest.stream.getAudioTracks()[0];
                if (!track) throw new Error("No se encontró pista de audio.");

                const processor = new MediaStreamTrackProcessor({ track });
                reader = processor.readable.getReader();
                showStatus("Pistas de audio listas...");
            } catch (ae) {
                console.error("Audio Track Error:", ae);
                throw new Error("Error al inicializar audio: " + ae.message);
            }

            audio.currentTime = startTime;
            if (state.bgType === 'video' && state.backgroundVideo.duration) {
                state.backgroundVideo.currentTime = (startTime + state.config.bg.delay) % state.backgroundVideo.duration;
            }

            let isRecording = true;
            let frameCount = 0;

            // Audio loop
            const processAudio = async () => {
                try {
                    while (isRecording) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (isRecording) {
                            audioEncoder.encode(value);
                        }
                        value.close();
                    }
                } catch (err) {
                    console.error("Audio Loop Error:", err);
                    isRecording = false;
                }
            };
            processAudio();

            // Video loop
            const encodeFrame = async () => {
                try {
                    if (!isRecording) return;

                    if (audio.currentTime >= endTime || audio.paused) {
                        isRecording = false;
                        showStatus("Finalizando archivo...");
                        await videoEncoder.flush();
                        await audioEncoder.flush();
                        muxer.finalize();

                        showStatus("Generando descarga...");
                        const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${(state.config.meta.song || 'video').replace(/\s+/g, '-')}.mp4`;
                        a.click();

                        showStatus("¡Exportación completada!");
                        if (callbacks.onComplete) callbacks.onComplete();
                        return;
                    }

                    const progress = (audio.currentTime - startTime) / (endTime - startTime);
                    showStatus(`Capturando: ${(progress * 100).toFixed(1)}%`);

                    // Ensure background video stays synced during export
                    if (state.bgType === 'video' && state.backgroundVideo.duration) {
                        const targetV = (audio.currentTime + state.config.bg.delay) % state.backgroundVideo.duration;
                        if (Math.abs(state.backgroundVideo.currentTime - targetV) > 0.1) {
                            state.backgroundVideo.currentTime = targetV;
                        }
                    }

                    const timestamp = (audio.currentTime - startTime) * 1_000_000;
                    const frame = new VideoFrame(canvas, { timestamp });
                    videoEncoder.encode(frame, { keyFrame: frameCount % 60 === 0 });
                    frame.close();
                    frameCount++;

                    requestAnimationFrame(encodeFrame);
                } catch (err) {
                    console.error("Video Loop Error:", err);
                    showError("Error en exportación: " + err.message);
                    isRecording = false;
                }
            };

            showStatus("Iniciando captura...");
            audio.play().catch(e => {
                showError("No se pudo iniciar el audio. " + e.message);
                isRecording = false;
            });
            if (state.bgType === 'video') state.backgroundVideo.play().catch(() => { });

            encodeFrame();

        } catch (e) {
            showError("Fallo MP4: " + e.message);
            console.error(e);
        }
    },

    async exportWebM(canvas, audio, state, dom, callbacks) {
        const { showStatus, showError, initAudioContext } = callbacks;

        const startTime = parseFloat(dom['export-start'].value) || 0;
        let endTime = parseFloat(dom['export-end'].value) || audio.duration;
        const fps = state.config.export.fps || 30;

        if (endTime <= startTime) return showError("Fin debe ser mayor que inicio.");

        initAudioContext();
        showStatus("Iniciando MediaRecorder (WebM)...");

        audio.currentTime = startTime;
        if (state.bgType === 'video' && state.backgroundVideo.duration) {
            state.backgroundVideo.currentTime = (startTime + state.config.bg.delay) % state.backgroundVideo.duration;
        }

        const stream = canvas.captureStream(fps);
        const dest = state.audioContext.createMediaStreamDestination();
        state.sourceNode.connect(dest);
        stream.addTrack(dest.stream.getAudioTracks()[0]);

        let mime = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';

        const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10000000 });
        const chunks = [];
        mr.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
        mr.onstop = () => {
            const blob = new Blob(chunks, { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video.webm`;
            a.click();
            showStatus("¡WebM Exportado!");
            if (callbacks.onComplete) callbacks.onComplete();
        };

        mr.start();
        audio.play();
        if (state.bgType === 'video') state.backgroundVideo.play();

        audio.ontimeupdate = () => {
            const progress = (audio.currentTime - startTime) / (endTime - startTime);
            showStatus(`WebM: ${(progress * 100).toFixed(1)}%...`);
            if (audio.currentTime >= endTime) {
                audio.pause(); mr.stop(); audio.ontimeupdate = null;
            }
        };
    }
};
