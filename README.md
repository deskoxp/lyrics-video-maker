# DESKOEDITOR V1 - Video Lyrics Pro

Un editor de video profesional basado en web para la creación de líricas y contenido musical para redes sociales (TikTok, Instagram Reels, YouTube Shorts). Esta herramienta permite sincronizar letras, aplicar efectos visuales dinámicos y exportar en alta calidad.

## 🚀 Características Principales

- **Arquitectura Modular**: Sistema basado en ES Modules para una mejor mantenibilidad (`render-engine`, `lyric-parser`, `video-exporter`).
- **Exportación MP4 Profesional**: Renderizado de alto rendimiento utilizando **WebCodecs API** y **mp4-muxer** (H.264/AAC).
- **Control de Calidad**: Selección de FPS personalizable (24fps Cine, 30fps Estándar, 60fps Fluido).
- **Sistema de Capas Visuales**:
    - **Fondo**: Soporta imágenes y videos con desenfoque (blur) y oscurecimiento dinámico.
    - **Letras**: Soporta formato LRC, sincronización manual (TAP) y JSON de Apple Music (Karaoke con sílabas).
    - **Logo de Banda**: Capa flotante con controles de escala, posición (X/Y) y opacidad.
    - **Marca de Agua**: Sello personalizado con control de opacidad.
- **Efectos en Tiempo Real**:
    - Visualizador de audio reactivo (Barras, Onda, Círculo).
    - Sistema de partículas personalizable (Nieve, Fuego, Estrellas, Estándar).
    - Filtros de viñeta y ruido fílmico.
    - Reactividad al "Beat" de la música.
- **Utilidades de Usuario**:
    - **Autoguardado**: Guarda tu proyecto y letras cada 30 segundos localmente.
    - **Sistema de Presets**: Guarda tus estilos favoritos para usarlos en segundos.
    - **Modo OBS**: Ventana popup dedicada para captura limpia en software de streaming.
    - **Limpieza de Memoria**: Gestión inteligente de Blobs para evitar memory leaks.

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+).
- **Librerías**: 
    - [Anime.js](https://animejs.com/) (Animaciones de UI).
    - [mp4-muxer](https://github.com/ed-pauley/mp4-muxer) (Contenedor MP4).
    - WebCodecs API (Codificación de hardware).
- **Iconos**: Font Awesome 6.

## 📦 Instalación y Uso

Debido a que el editor utiliza **ES Modules** y **WebCodecs API**, se requiere un entorno de servidor seguro (`http://localhost` o `https://`).

1. Clona o descarga este repositorio.
2. Abre la carpeta en tu editor favorito (recomendado **VS Code**).
3. Utiliza una de las siguientes opciones para ejecutarlo:
    - **VS Code**: Instala la extensión "Live Server" y pulsa "Go Live".
    - **Node.js**: Ejecuta `npx serve` en la terminal.
    - **Python**: Ejecuta `python -m http.server`.
4. Accede a la URL proporcionada (usualmente `http://127.0.0.1:5500`).

## 📋 Requisitos del Navegador

Se recomienda el uso de navegadores modernos basados en **Chromium** (Google Chrome, Microsoft Edge, Brave) para garantizar la compatibilidad con WebCodecs API y el rendimiento de renderizado.

---
Desarrollado por **Antigravity** para la comunidad de creadores.
