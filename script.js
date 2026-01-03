const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const audio = new Audio();
const videoPreview = document.getElementById('videoPreview');
const webcam = document.getElementById('webcam');
let lyrics = [];
let audioCtx, analyser, source, dataArray;
let mediaRecorder, recordedChunks = [];
let stream;
const MAX_DURATION = 60 * 1000; // 1 min

// Redimensionar canvas para IG vertical
function resizeCanvas() {
    canvas.width = 1080;
    canvas.height = 1920;
}

// Cargar MP3
document.getElementById('mp3File').addEventListener('change', (e) => {
    const file = e.target.files[0];
    audio.src = URL.createObjectURL(file);
    audio.addEventListener('loadedmetadata', () => {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    });
});

// Buscar letras
document.getElementById('getLyrics').addEventListener('click', async () => {
    const artist = document.getElementById('artist').value;
    const title = document.getElementById('title').value;
    try {
        const res = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
        const data = await res.json();
        lyrics = data.lyrics.split('\n').filter(l => l.trim());
        displayLyrics();
    } catch (err) {
        alert('Error al buscar letras');
    }
});

// Mostrar letras preview
function displayLyrics() {
    const preview = document.getElementById('lyricsPreview');
    preview.innerHTML = lyrics.map((line, i) => `<div class="lyric-line" data-index="${i}">${line}</div>`).join('');
}

// Cargar video fondo (webcam o archivo)
document.getElementById('videoFile').addEventListener('change', (e) => {
    videoPreview.src = URL.createObjectURL(e.target.files[0]);
    videoPreview.play();
});
async function initWebcam() {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    webcam.srcObject = stream;
    webcam.play();
}

// Loop de animación
let startTime;
function animate(currentTime) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar fondo (webcam o video)
    if (webcam.videoWidth) {
        ctx.save();
        ctx.scale(canvas.width / webcam.videoWidth, canvas.height / webcam.videoHeight);
        ctx.drawImage(webcam, 0, 0);
        ctx.restore();
    } else if (videoPreview.videoWidth) {
        ctx.save();
        ctx.scale(canvas.width / videoPreview.videoWidth, canvas.height / videoPreview.videoHeight);
        ctx.drawImage(videoPreview, 0, 0);
        ctx.restore();
    }
    
    // Render letras sincronizadas (simplificado: por tiempo)
    if (startTime && lyrics.length) {
        const elapsed = currentTime - startTime;
        const index = Math.min(Math.floor(elapsed / 5000), lyrics.length - 1); // Cambia cada 5s
        document.querySelectorAll('.lyric-line').forEach((line, i) => {
            line.classList.toggle('active', i === index);
        });
        
        // Efecto: letras grandes en centro con glow
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.font = 'bold 120px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = '#ff4081';
        ctx.shadowBlur = 20;
        ctx.textAlign = 'center';
        ctx.fillText(lyrics[index] || '', 0, 0);
        ctx.restore();
    }
    
    requestAnimationFrame(animate);
}

// Iniciar grabación
document.getElementById('startRecord').addEventListener('click', async () => {
    if (!audio.src || !lyrics.length) return alert('Sube MP3 y busca letras');
    
    resizeCanvas();
    await initWebcam();
    audio.play();
    startTime = performance.now();
    
    // Stream canvas + audio
    const canvasStream = canvas.captureStream(30); // 30fps
    const audioTrack = audio.captureStream ? audio.captureStream(0).getAudioTracks()[0] : null;
    if (audioTrack) canvasStream.addTrack(audioTrack);
    
    mediaRecorder = new MediaRecorder(canvasStream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/mp4' });
    mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        document.getElementById('downloadLink').href = URL.createObjectURL(blob);
        document.getElementById('downloadLink').download = 'lyrics-video.webm';
        document.getElementById('downloadLink').style.display = 'inline-block';
        stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), MAX_DURATION);
    animate(performance.now());
});

// Descargar
document.getElementById('download').addEventListener('click', () => {
    document.getElementById('downloadLink').click();
});
