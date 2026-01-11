# DESKOEDITOR V1 - Editor de Video con Letras

Editor profesional de videos con letras sincronizadas para redes sociales.

## 🔧 Cambios Recientes (2026-01-10)

### Problemas Solucionados

1. **✅ CRÍTICO: Aplicación no renderizaba**
   - **Problema**: Los módulos ES6 (`type="module"`) no funcionan con el protocolo `file://` por restricciones CORS del navegador
   - **Solución**: Se consolidó todo el código en un solo archivo `app.js` sin usar módulos ES6
   - **Resultado**: La aplicación ahora funciona correctamente al abrirla directamente desde el explorador de archivos

2. **✅ Sincronización de video mejorada**
   - **Problema**: El video de fondo se laggeaba y no se sincronizaba correctamente con el audio
   - **Solución**: 
     - Implementado sistema de sincronización adaptativa con threshold dinámico (0.2s normal, 0.5s después de seek)
     - Agregado tracking de última sincronización para evitar seeks excesivos
     - Mejorada la carga del video con `preload="auto"` y eventos `loadedmetadata`
   - **Resultado**: Sincronización mucho más fluida y precisa entre audio y video

3. **✅ Renderizado optimizado**
   - El loop de renderizado ahora se ejecuta continuamente cuando el audio está reproduciéndose
   - Mejor manejo del estado de reproducción del video de fondo

## 📋 Características

- ✨ Sincronización precisa de letras con audio
- 🎬 Soporte para video o imagen de fondo
- 🎨 Múltiples estilos de texto (Neon, Bold, Elegant, Arcade)
- 🎭 Efectos visuales (Partículas, Viñeta, Ruido)
- 🎵 Visualizador de audio (Barras, Onda, Circular)
- 📝 Soporte para formato LRC y Apple Music Karaoke
- 🌐 Traducción línea por línea
- 💾 Autoguardado cada 30 segundos
- 📤 Exportación a MP4 o WebM

## 🚀 Cómo Usar

### Opción 1: Abrir Directamente (Para visualización y edición)
1. Simplemente abre `index.html` en tu navegador (doble clic)
2. La aplicación funcionará para editar y previsualizar
3. **Nota**: Para exportar video necesitarás usar la Opción 2

### Opción 2: Con Servidor Local (Recomendado para exportación)
```bash
# Con Python 3
python -m http.server 8000

# Con Node.js (si tienes http-server instalado)
npx http-server

# Luego abre: http://localhost:8000
```

**¿Por qué necesito un servidor para exportar?**
- La exportación MP4 requiere la librería `mp4-muxer` que se carga desde un CDN
- Los navegadores bloquean las peticiones CDN cuando se usa el protocolo `file://`
- Con un servidor local (`http://localhost`), todo funciona perfectamente

## 📖 Guía Rápida

### 1. Cargar Audio
- Ve a la pestaña **Audio**
- Haz clic en "Subir MP3 / M4A" y selecciona tu archivo de audio

### 2. Agregar Fondo
- Ve a la pestaña **Fondo**
- Haz clic en "Imagen o Video" y selecciona tu archivo
- Ajusta el desenfoque, oscuridad, escala y delay según necesites

### 3. Agregar Letras
- En la pestaña **Audio**, pega tus letras en el área de texto
- Soporta formato LRC: `[00:12.50]Letra de la canción`
- O usa el buscador rápido para encontrar letras online

### 4. Sincronizar
- Ve a la pestaña **Exportar**
- Haz clic en "Grabar Sincronización"
- Presiona **ESPACIO** o el botón **TAP** al inicio de cada línea
- Haz clic en "Finalizar / Guardar" cuando termines

### 5. Personalizar
- **Pestaña Texto**: Cambia colores, tamaño, efectos de animación
- **Pestaña Fondo**: Ajusta efectos visuales y visualizador de audio
- Guarda tus configuraciones favoritas como presets

### 6. Exportar
- Configura el rango de tiempo (inicio/fin)
- Selecciona formato (MP4 o WebM) y FPS
- Haz clic en "Renderizar Video"

## 🎨 Efectos Especiales en Letras

Puedes agregar efectos especiales a líneas específicas usando marcadores:

- `***Texto***` - Efecto Pulse (pulsante)
- `%%%Texto%%%` - Efecto Glitch (distorsión)
- `###Texto###` - Efecto Flash (parpadeo)

## 🔧 Archivos Principales

- `index.html` - Interfaz de usuario
- `app.js` - **NUEVO** - Aplicación consolidada (sin módulos ES6)
- `effects.js` - Efectos visuales personalizados
- `style.css` - Estilos de la interfaz
- `coi-serviceworker.js` - Service Worker para SharedArrayBuffer

### Archivos Antiguos (Ya no se usan)
- `script.js` - Reemplazado por `app.js`
- `render-engine.js` - Ahora integrado en `app.js`
- `lyric-parser.js` - Ahora integrado en `app.js`
- `video-exporter.js` - Funcionalidad básica en `app.js`

## ⚙️ Configuración de Sincronización de Video

La sincronización del video de fondo ahora usa un sistema adaptativo:

- **Threshold normal**: 0.2 segundos (sincronización precisa durante reproducción)
- **Threshold post-seek**: 0.5 segundos (evita lag inmediatamente después de adelantar/retroceder)
- **Tracking de sincronización**: Evita seeks excesivos que causan lag

Puedes ajustar el delay del video en la pestaña **Fondo** → **Sincronización (Delay)** si necesitas compensar algún desfase.

## 🐛 Solución de Problemas

### El botón de exportar no hace nada o muestra error de Mp4Muxer
- **Causa**: Estás abriendo el archivo directamente (`file://`) y la librería CDN no se puede cargar
- **Solución**: Usa un servidor local (ver Opción 2 arriba)
- **Alternativa**: Cambia el formato a WebM en la pestaña Exportar (no requiere CDN)

### El video se ve laggeado
- Asegúrate de que el video no sea demasiado pesado (recomendado: 1080p o menos)
- Ajusta el delay de sincronización en la pestaña Fondo
- Prueba con un formato de video más ligero (MP4 H.264)

### Las letras no se sincronizan
- Verifica que el formato LRC sea correcto: `[MM:SS.mm]Texto`
- Usa el modo de sincronización manual en la pestaña Exportar
- Revisa los tiempos en el editor de timeline

### La aplicación no carga
- Asegúrate de abrir `index.html` (no otros archivos)
- Verifica que todos los archivos estén en la misma carpeta
- Revisa la consola del navegador (F12) para ver errores

## 📝 Notas Técnicas

- El canvas renderiza a 1080x1920 (formato vertical para redes sociales)
- Autoguardado cada 30 segundos en localStorage
- Soporte para audio reactivo en el fondo
- Optimizado para Chrome/Edge (recomendado)

## 🎯 Próximas Mejoras

- [ ] Integración completa de video-exporter.js en app.js
- [ ] Más efectos de texto personalizados
- [ ] Soporte para múltiples pistas de audio
- [ ] Exportación con progreso visual
- [ ] Plantillas predefinidas

---

**Versión**: 1.0.1  
**Última actualización**: 2026-01-10  
**Desarrollado por**: DESKO
