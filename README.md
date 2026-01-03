LYRICS VIDEO MAKER PARA INSTAGRAM - README COMPLETO

# Lyrics Video Maker para Instagram

[![GitHub Pages](https://github.com/badges/active/main)](https://github.com/YOUR_USERNAME/lyrics-video-maker/actions)
[![Demo](https://img.shields.io/badge/Live%20Demo-blue?logo=github)](https://tuusuario.github.io/lyrics-video-maker)

Crea videos de lyrics musicales de hasta 1 minuto optimizados para Instagram Reels/TikTok directamente en el navegador. Sube tu MP3, busca letras automaticamente, agrega efectos visuales y graba con camara/webcam como fondo. 100% client-side, sin servidor.

## Caracteristicas

- Sube cualquier MP3 y reproducelo sincronizado
- Lyrics.ovh API gratuita - busca letras por artista/titulo
- Graba con webcam o usa video de fondo personalizado
- Efectos profesionales: Glow, scale, transiciones suaves
- Formato vertical IG (1080x1920) listo para publicar
- Exporta MP4/WebM descargable en segundos
- GitHub Pages ready - HTML/CSS/JS puro

## Demo Rapido

1. Sube MP3 -> "Sleep Token - Alkaline"
2. Busca letras -> Aparecen automaticamente  
3. Activa camara -> Preview en vivo
4. Graba 60s -> Descarga lista para IG!

## Instalacion (GitHub Pages)

git init lyrics-video-maker
cd lyrics-video-maker

# Copia los 3 archivos del proyecto
# index.html, style.css, script.js

git add .
git commit -m "Initial lyrics video maker"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/lyrics-video-maker.git
git push -u origin main

Settings -> Pages -> Source: Deploy from branch main

## Caracteristicas Tecnicas

Tecnologia          | Uso
--------------------|-------------------------
HTML5 Canvas        | Render letras + video fondo
Web Audio API       | Reproduce MP3 sincronizado
Lyrics.ovh API      | Letras gratuitas GET /artist/title
MediaRecorder       | Exporta video 30fps
getUserMedia        | Webcam como fondo

## Efectos Incluidos

- Glow neon en letras activas
- Scale animado (1.1x)
- Transiciones fade 0.5s
- Canvas 1080x1920 vertical
- Sincronizacion cada 5s

## Personalizacion

Agregar mas efectos (script.js):

// Efecto typewriter
ctx.strokeText(lyrics[index].slice(0, typePos), 0, 0);

// Efecto wave
ctx.save();
for(let i = 0; i < text.length; i++) {
    ctx.translate(0, Math.sin(i * 0.1 + time) * 10);
    ctx.fillText(text[i], x, y);
}

Colores personalizados (style.css):

.active { 
    color: #00f5ff; /* Cian */
    text-shadow: 0 0 30px #00f5ff;
}

## Plataformas Soportadas

Navegador    | Estado    | Formato
-------------|-----------|---------
Chrome 80+   | Perfecto  | MP4/WebM
Firefox 70+  | Perfecto  | WebM
Safari 14+   | Parcial   | Requiere polyfill
Mobile       | Funciona  | Vertical optimizado

## Ejemplos de Canciones

Metalcore: "Bring Me The Horizon - Parasite Eve"
Pop: "Dua Lipa - Levitating" 
Anime OP: "LiSA - Gurenge"

## Limitaciones

- Lyrics.ovh: Cobertura ~70% canciones populares
- Safari: MediaRecorder experimental
- Sincronizacion: Basica (5s/linea) - sin timestamps LRC
- Tamano: Max 60 segundos

## Contributing

1. Fork el repositorio
2. Crea tu feature branch (git checkout -b feature/amazing-effect)
3. Commit cambios (git commit -m 'Add typewriter effect')
4. Push al branch (git push origin feature/amazing-effect)
5. Abre Pull Request

## Licencia

MIT License - usa libremente en comerciales/streaming.

## Agradecimientos

- Lyrics.ovh - API gratuita lyrics
- MDN Canvas API - Documentacion
- GitHub Pages - Hosting gratis

---

Crea tus lyric videos en segundos! 

Hecho con corazon para streamers y creadores de contenido
