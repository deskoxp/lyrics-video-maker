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
                throw new Error("WebCodecs no soportado. Usa formato WebM.");
            }

            const startTime = parseFloat(dom['export-start'].value) || 0;
            let endTime = parseFloat(dom['export-end'].value) || audio.duration;
            const fps = state.config.export.fps || 30;

            if (endTime <= startTime) return showError("Fin debe ser mayor que inicio.");

            initAudioContext();
            showStatus("Inicializando codificadores MP4...");

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
                error: (e) => showError("Error Video: " + e.message)
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
                error: (e) => showError("Error Audio: " + e.message)
            });

            audioEncoder.configure({
                codec: 'mp4a.40.2',
                numberOfChannels: 2,
                sampleRate: state.audioContext.sampleRate,
                bitrate: 128_000
            });

            // Preparar Audio Stream
            const dest = state.audioContext.createMediaStreamDestination();
            state.sourceNode.connect(dest);
            const track = dest.stream.getAudioTracks()[0];
            const processor = new MediaStreamTrackProcessor({ track });
            const reader = processor.readable.getReader();

            audio.currentTime = startTime;
            if (state.bgType === 'video' && state.backgroundVideo.duration) {
                state.backgroundVideo.currentTime = (startTime + state.config.bg.delay) % state.backgroundVideo.duration;
            }

            let isRecording = true;
            let frameCount = 0;
            const exportStartRealTime = Date.now();

            // Audio loop
            const processAudio = async () => {
                while (isRecording) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (isRecording) audioEncoder.encode(value);
                    value.close();
                }
            };
            processAudio();

            // Video loop
            const encodeFrame = async () => {
                if (!isRecording) return;

                if (audio.currentTime >= endTime || audio.paused) {
                    isRecording = false;
                    showStatus("Procesando archivos finales...");
                    await videoEncoder.flush();
                    await audioEncoder.flush();
                    muxer.finalize();

                    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(state.config.meta.song || 'video').replace(/\s+/g, '-')}.mp4`;
                    a.click();
                    showStatus("¡MP4 Exportado!");
                    if (callbacks.onComplete) callbacks.onComplete();
                    return;
                }

                const progress = (audio.currentTime - startTime) / (endTime - startTime);
                showStatus(`MP4: ${(progress * 100).toFixed(1)}% | Capturando...`);

                const timestamp = (audio.currentTime - startTime) * 1_000_000;
                const frame = new VideoFrame(canvas, { timestamp });
                videoEncoder.encode(frame, { keyFrame: frameCount % 60 === 0 });
                frame.close();
                frameCount++;

                requestAnimationFrame(encodeFrame);
            };

            audio.play();
            if (state.bgType === 'video') state.backgroundVideo.play();
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
