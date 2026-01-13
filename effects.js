/**
 * DESKOEDITOR V1 - Effects Registry
 * En este archivo puedes definir nuevos efectos visuales para las letras.
 * Cada efecto recibe el contexto del canvas (ctx), el objeto de la línea actual, el volumen medio, etc.
 */

const EffectsRegistry = {
    // --- EFECTOS BASE ---

    pulse: (ctx, { scale, avgVol }) => {
        // Mejorado: pulso más suave y rítmico
        const beatScale = (avgVol / 255) * 0.3; // Reacción al bajo
        const smoothScale = 1 + beatScale;
        ctx.scale(smoothScale, smoothScale);
    },

    glitch: (ctx, { w, h }) => {
        const shakeX = (Math.random() - 0.5) * 20;
        const shakeY = (Math.random() - 0.5) * 5;
        ctx.translate(shakeX, shakeY);
        if (Math.random() > 0.9) {
            ctx.globalCompositeOperation = 'difference';
            ctx.fillStyle = Math.random() > 0.5 ? '#ff00ff' : '#00ffff';
        }
    },

    flash: (ctx) => {
        // Estroboscópico rápido
        if (Math.floor(Date.now() / 40) % 2 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffffff';
            ctx.shadowBlur = 50;
            ctx.shadowColor = '#ffffff';
        }
    },

    // --- EFECTOS EXTRA ---

    neon_flicker: (ctx) => {
        // Simula un neón fallando de forma random
        const flicker = Math.random() > 0.92 ? 0.2 : 1;
        ctx.globalAlpha *= flicker;
        ctx.shadowBlur = (20 + Math.random() * 20) * flicker;
    },

    rainbow: (ctx) => {
        // Ciclo de colores RGB suave
        const hue = (Date.now() / 15) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 75%)`;
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 25;
        // También afectar al borde si es estilo bold
        ctx.strokeStyle = `hsl(${(hue + 180) % 360}, 100%, 50%)`;
    },

    shake: (ctx, { avgVol }) => {
        // Temblor fuerte reactivo al volumen
        const intensity = 5 + (avgVol / 255) * 25;
        const rot = (Math.random() - 0.5) * 0.1 * (avgVol / 255);
        ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
        ctx.rotate(rot);
    },

    floating: (ctx) => {
        // Movimiento suave de flotación (onda sinusoidal)
        const t = Date.now() / 800;
        const y = Math.sin(t) * 15;
        const rot = Math.cos(t) * 0.05;
        ctx.translate(0, y);
        ctx.rotate(rot);
    }
};

window.EffectsRegistry = EffectsRegistry;
