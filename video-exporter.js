/**
 * DESKOEDITOR V1 - Professional MP4 Exporter
 * Utiliza WebCodecs API + mp4-muxer para renderizado MP4 de alta fidelidad.
 */

/* global Mp4Muxer */

export const VideoExporter = {
    async export(canvas, audio, state, dom, callbacks) {
        const { showStatus, showError, initAudioContext } = callbacks;

        const startTime = parseFloat(dom['export-start'].value) || 0;
        let endTime = parseFloat(dom['export-end'].value) || audio.duration;
        const fps = state.config.export.fps || 30;

        if (endTime <= startTime) return showError("El tiempo de fin debe ser mayor al de inicio.");

        initAudioContext();
        showStatus("Preparando codificadores...");

        // 1. Setup Muxer
        const muxer = new Mp4Muxer.Muxer({
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: {
                codec: 'avc1.42E01E', // Baseline profile for maximum compatibility
                width: canvas.width,
                height: canvas.height
            },
            audio: {
                codec: 'mp4a.40.2', // AAC
                numberOfChannels: 2,
                sampleRate: state.audioContext.sampleRate
            },
            fastStart: 'fragmented'
        });

        // 2. Setup Video Encoder
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

        // 3. Setup Audio Encoder
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

        // 4. Capture Streams
        const audioStreamDestination = state.audioContext.createMediaStreamDestination();
        state.sourceNode.connect(audioStreamDestination);

        const audioTrack = audioStreamDestination.stream.getAudioTracks()[0];
        const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });
        const audioReader = audioProcessor.readable.getReader();

        // 5. Recording State
        audio.currentTime = startTime;
        if (state.bgType === 'video' && state.backgroundVideo.duration) {
            state.backgroundVideo.currentTime = (startTime + state.config.bg.delay) % state.backgroundVideo.duration;
        }

        let isRecording = true;
        let frameCount = 0;
        const exportStartRealTime = Date.now();

        // Audio Processing loop
        const processAudio = async () => {
            while (isRecording) {
                const { done, value } = await audioReader.read();
                if (done) break;
                if (isRecording) {
                    audioEncoder.encode(value);
                }
                value.close();
            }
        };
        processAudio();

        // Video Encoding loop
        const encodeFrame = async () => {
            if (!isRecording) return;

            if (audio.currentTime >= endTime || audio.paused) {
                isRecording = false;
                showStatus("Finalizando archivo...");

                await videoEncoder.flush();
                await audioEncoder.flush();
                muxer.finalize();

                const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(state.config.meta.song || 'video').replace(/\s+/g, '-')}.mp4`;
                a.click();

                showStatus("¡Exportación Exitosa!");
                setTimeout(() => URL.revokeObjectURL(url), 10000);

                if (callbacks.onComplete) callbacks.onComplete();
                return;
            }

            // Sync indicators
            const progress = (audio.currentTime - startTime) / (endTime - startTime);
            const elapsed = (Date.now() - exportStartRealTime) / 1000;
            const remaining = progress > 0 ? (elapsed / progress) - elapsed : 0;
            showStatus(`Renderizando: ${(progress * 100).toFixed(1)}% | Quedan: ${Math.round(remaining)}s`);

            // Capture Frame
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
    }
};
