/**
 * Capa de integración observada en la variante del video.
 * No cambia el algoritmo óptico del repo.
 *
 * Añade:
 * - atributo contrast-observer para legibilidad del contenido
 * - Pointer Events para que el estado de presión del componente responda en móvil
 */
(() => {
    const enhance = (el) => {
        if (!el || el.dataset.videoVariantReady === '1') return;
        el.dataset.videoVariantReady = '1';

        const applyContrast = () => {
            if (!el.hasAttribute('contrast-observer')) return;
            const content = el.shadowRoot?.querySelector('.content');
            if (!content) return;

            // En el video el atributo se usa como capa de legibilidad.
            // Sin rasterizar el backdrop, mantenemos el contenido estable con
            // un foreground configurable y una sombra mínima.
            content.style.color = 'var(--glass-foreground, rgba(255,255,255,.96))';
            content.style.textShadow = '0 1px 3px rgba(0,0,0,.24)';
        };

        requestAnimationFrame(applyContrast);

        const press = () => {
            el.clicked = true;
            el.updateStyles?.();
        };
        const release = () => {
            if (!el.clicked) return;
            el.clicked = false;
            el.updateStyles?.();
        };

        el.addEventListener('pointerdown', press, { passive: true });
        el.addEventListener('pointerup', release, { passive: true });
        el.addEventListener('pointercancel', release, { passive: true });
        el.addEventListener('lostpointercapture', release, { passive: true });
        el._videoVariantHandlers = { press, release };

        if (el.hasAttribute('contrast-observer')) {
            const mo = new MutationObserver(applyContrast);
            mo.observe(el, { attributes: true, attributeFilter: ['style', 'class', 'contrast-observer'] });
            el._videoContrastObserver = mo;
        }
    };

    const scan = (root = document) => {
        root.querySelectorAll?.('glass-element').forEach(enhance);
    };

    const release = (el) => {
        if (!el || el.dataset.videoVariantReady !== '1') return;
        const handlers = el._videoVariantHandlers;
        if (handlers) {
            el.removeEventListener('pointerdown', handlers.press);
            el.removeEventListener('pointerup', handlers.release);
            el.removeEventListener('pointercancel', handlers.release);
            el.removeEventListener('lostpointercapture', handlers.release);
            delete el._videoVariantHandlers;
        }
        el._videoContrastObserver?.disconnect();
        delete el._videoContrastObserver;
        delete el.dataset.videoVariantReady;
    };

    customElements.whenDefined('glass-element').then(() => {
        // The component emits lifecycle events, so only one initial scan is
        // needed. A permanent subtree MutationObserver was waking on every
        // React DOM mutation across the entire application.
        document.addEventListener('novo:glass-connected', (event) => enhance(event.target));
        document.addEventListener('novo:glass-disconnected', (event) => release(event.target));
        scan();
    });
})();
