/**
 * DESKOEDITOR V1 - Effects Registry
 * En este archivo puedes definir nuevos efectos visuales para las letras.
 * Cada efecto recibe el contexto del canvas (ctx), el objeto de la línea actual, el volumen medio, etc.
 */

const EffectsRegistry = {
    // --- EFECTOS BASE ---

    pulse: (ctx, { scale, avgVol }) => {
        let s = scale * 0.5;
        s += (avgVol / 255) * 0.5;
        ctx.scale(s, s);
    },

    glitch: (ctx, { w, h }) => {
        const shakeX = (Math.random() - 0.5) * 20;
        const shakeY = (Math.random() - 0.5) * 5;
        ctx.translate(shakeX, shakeY);
        if (Math.random() > 0.8) ctx.globalCompositeOperation = 'exclusion';
    },

    flash: (ctx) => {
        if (Math.floor(Date.now() / 50) % 2 === 0) {
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 100;
            ctx.shadowColor = '#fff';
        }
    },

    // --- EFECTOS EXTRA (Agrega los tuyos aquí) ---

    neon_flicker: (ctx) => {
        // Simula un neón fallando
        const flicker = Math.random() > 0.9 ? 0.3 : 1;
        ctx.globalAlpha *= flicker;
        ctx.shadowBlur = 30 * flicker;
    },

    rainbow: (ctx) => {
        // Ciclo de colores RGB
        const hue = (Date.now() / 20) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 20;
    },

    shake: (ctx, { avgVol }) => {
        // Temblor reactivo al volumen
        const intensity = (avgVol / 255) * 15;
        ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
    },

    floating: (ctx) => {
        // Movimiento suave de flotación
        const y = Math.sin(Date.now() / 500) * 15;
        ctx.translate(0, y);
    }
};

window.EffectsRegistry = EffectsRegistry;
