/**
 * GlassElement — base óptica de srdavo/liquid-glass.
 *
 * Esta versión mantiene el comportamiento del repositorio como núcleo:
 * - Web Component + Shadow DOM
 * - mapa de desplazamiento SVG generado al tamaño real
 * - feDisplacementMap RGB para aberración cromática
 * - auto-size / responsive / fallback blur
 *
 * Las adiciones específicas de la variante del video viven en video-variant.js
 * para no alterar la óptica del repositorio.
 */
class GlassElement extends HTMLElement {
    constructor() {
        super();
        this.clicked = false;
        this._pendingFrames = new Set();
        this._autoSizeMutationObserver = null;
        this._autoSizeResizeObserver = null;
        this._responsiveResizeHandler = null;
        this._glassBox = null;
        this._glassBoxHandlers = null;
        this._documentMouseUpHandler = null;
        this._pendingAttributeChanges = new Set();
        this.attachShadow({ mode: 'open' });

        if (GlassElement._svgFilterSupport === undefined) {
            GlassElement._svgFilterSupport = this.detectSVGFilterSupport();
            console.log(`[GlassElement] SVG Filter Support: ${GlassElement._svgFilterSupport ? '✅ YES' : '❌ NO'} (${navigator.userAgent.match(/(chrome|firefox|safari|edg)/i)?.[0] || 'unknown'})`);
        }
    }

    detectSVGFilterSupport() {
        const testElement = document.createElement('div');
        testElement.style.backdropFilter = 'blur(1px)';
        if (!testElement.style.backdropFilter) return false;

        const userAgent = navigator.userAgent.toLowerCase();
        const isChrome = /chrome|chromium|crios|edg/.test(userAgent) && !/firefox|fxios/.test(userAgent);
        const isFirefox = /firefox|fxios/.test(userAgent);
        const isSafari = /safari/.test(userAgent) && !/chrome|chromium|crios|edg/.test(userAgent);

        if (isChrome) return true;
        if (isFirefox || isSafari) return false;

        try {
            testElement.style.backdropFilter = 'url(#test)';
            return testElement.style.backdropFilter.includes('url');
        } catch (e) {
            return false;
        }
    }

    get hasSVGFilterSupport() {
        return GlassElement._svgFilterSupport;
    }

    static get observedAttributes() {
        return [
            'width',
            'height',
            'radius',
            'depth',
            'blur',
            'strength',
            'chromatic-aberration',
            'debug',
            'background-color',
            'responsive',
            'base-width',
            'base-height',
            'auto-size',
            'min-width',
            'min-height'
        ];
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
        this.setupResponsive();
        if (this.autoSize) this.setupAutoSizeObserver();
        this.dispatchEvent(new CustomEvent('novo:glass-connected', { bubbles: true, composed: true }));
    }

    disconnectedCallback() {
        this.releaseAutoSizeObservers();
        this.releaseElementListeners();

        if (this._responsiveResizeHandler) {
            window.removeEventListener('resize', this._responsiveResizeHandler);
            this._responsiveResizeHandler = null;
        }
        this._pendingFrames.forEach((frame) => cancelAnimationFrame(frame));
        this._pendingFrames.clear();
        this.clicked = false;
        this.dispatchEvent(new CustomEvent('novo:glass-disconnected', { bubbles: true, composed: true }));
    }

    releaseAutoSizeObservers() {
        this._autoSizeMutationObserver?.disconnect();
        this._autoSizeMutationObserver = null;
        this._autoSizeResizeObserver?.disconnect();
        this._autoSizeResizeObserver = null;
    }

    releaseElementListeners() {
        if (this._glassBox && this._glassBoxHandlers) {
            for (const [type, handler] of Object.entries(this._glassBoxHandlers)) {
                this._glassBox.removeEventListener(type, handler);
            }
        }
        if (this._documentMouseUpHandler) {
            document.removeEventListener('mouseup', this._documentMouseUpHandler);
            this._documentMouseUpHandler = null;
        }
        this._glassBox = null;
        this._glassBoxHandlers = null;
    }

    setupAutoSizeObserver() {
        if (this._autoSizeMutationObserver) return;
        this._autoSizeMutationObserver = new MutationObserver(() => {
            if (this._autoSizeUpdateQueued) return;
            this._autoSizeUpdateQueued = true;
            queueMicrotask(() => {
                this._autoSizeUpdateQueued = false;
                if (this.isConnected) this.updateStyles();
            });
        });

        this._autoSizeMutationObserver.observe(this, {
            childList: true,
            subtree: true,
            characterData: true
        });

        if (window.ResizeObserver) {
            this._autoSizeResizeObserver = new ResizeObserver(() => {
                if (this.isConnected) this.updateStyles();
            });
            const glassBox = this.shadowRoot.querySelector('.glass-box');
            if (glassBox) this._autoSizeResizeObserver.observe(glassBox);
        }
    }

    setupResponsive() {
        if (this.hasAttribute('responsive')) {
            this.updateResponsiveSize();
            this.setupResponsiveListener();
        }
    }

    setupResponsiveListener() {
        if (!this._responsiveResizeHandler) {
            this._responsiveResizeHandler = () => this.updateResponsiveSize();
            window.addEventListener('resize', this._responsiveResizeHandler, { passive: true });
        }
    }

    updateResponsiveSize() {
        const baseWidth = parseInt(this.getAttribute('base-width') || this.getAttribute('width')) || 200;
        const baseHeight = parseInt(this.getAttribute('base-height') || this.getAttribute('height')) || 200;
        const viewport = window.innerWidth;

        let scale = 1;
        if (viewport < 480) scale = 0.6;
        else if (viewport < 768) scale = 0.8;
        else if (viewport < 1024) scale = 0.9;

        const newWidth = Math.round(baseWidth * scale);
        const newHeight = Math.round(baseHeight * scale);

        if (newWidth !== this.width || newHeight !== this.height) {
            this.setAttribute('width', newWidth);
            this.setAttribute('height', newHeight);
        }
    }

    attributeChangedCallback(name) {
        this._pendingAttributeChanges.add(name);
        if (name === 'auto-size' || name === 'min-width' || name === 'min-height') {
            this._structuralRenderQueued = true;
        }
        // React configures the lens with several attributes in one commit.
        // Coalesce that burst instead of rebuilding the shadow tree once per
        // attribute. Geometry/optical changes only need a new displacement map.
        if (!this.shadowRoot || this._renderQueued) return;
        this._renderQueued = true;
        queueMicrotask(() => {
            this._renderQueued = false;
            if (!this.isConnected) return;

            const changedAttributes = this._pendingAttributeChanges;
            this._pendingAttributeChanges = new Set();
            const structural = this._structuralRenderQueued;
            this._structuralRenderQueued = false;
            if (structural) {
                this.releaseAutoSizeObservers();
                this.releaseElementListeners();
                this.render();
                this.setupEventListeners();
                if (this.autoSize) this.setupAutoSizeObserver();
            } else {
                if (this.hasAttribute('responsive')) {
                    if (changedAttributes.has('responsive') || changedAttributes.has('base-width') || changedAttributes.has('base-height')) {
                        this.updateResponsiveSize();
                    }
                    this.setupResponsiveListener();
                }
                else if (this._responsiveResizeHandler) {
                    window.removeEventListener('resize', this._responsiveResizeHandler);
                    this._responsiveResizeHandler = null;
                }
                this.updateStyles();
            }
        });
    }

    get width() { return parseInt(this.getAttribute('width')) || 200; }
    get height() { return parseInt(this.getAttribute('height')) || 200; }
    get radius() { return parseInt(this.getAttribute('radius')) || 50; }
    get baseDepth() { return parseInt(this.getAttribute('depth')) || 10; }
    get blur() { return parseInt(this.getAttribute('blur')) || 2; }
    get strength() { return parseInt(this.getAttribute('strength')) || 100; }
    get chromaticAberration() { return parseInt(this.getAttribute('chromatic-aberration')) || 0; }
    get debug() { return this.getAttribute('debug') === 'true'; }
    get backgroundColor() { return this.getAttribute('background-color') || 'rgba(255, 255, 255, 0.4)'; }
    get autoSize() { return this.hasAttribute('auto-size'); }
    get minWidth() { return parseInt(this.getAttribute('min-width')) || 0; }
    get minHeight() { return parseInt(this.getAttribute('min-height')) || 0; }

    get depth() {
        return this.baseDepth / (this.clicked ? 0.7 : 1);
    }

    setupEventListeners() {
        const glassBox = this.shadowRoot.querySelector('.glass-box');
        if (!glassBox) return;

        this._glassBox = glassBox;
        this._glassBoxHandlers = {
            mousedown: () => {
            this.clicked = true;
            this.updateStyles();
            },
            mouseup: () => {
            this.clicked = false;
            this.updateStyles();
            },
            mouseleave: () => {
            this.clicked = false;
            this.updateStyles();
            },
        };
        for (const [type, handler] of Object.entries(this._glassBoxHandlers)) {
            glassBox.addEventListener(type, handler);
        }

        this._documentMouseUpHandler = () => {
            if (this.clicked) {
                this.clicked = false;
                this.updateStyles();
            }
        };
        document.addEventListener('mouseup', this._documentMouseUpHandler);
    }

    scheduleFrame(callback) {
        const frame = requestAnimationFrame(() => {
            this._pendingFrames.delete(frame);
            if (this.isConnected) callback();
        });
        this._pendingFrames.add(frame);
        return frame;
    }

    updateStyles() {
        const glassBox = this.shadowRoot.querySelector('.glass-box');
        if (glassBox) this.applyDynamicStyles(glassBox);
    }

    applyDynamicStyles(element) {
        const { getDisplacementFilter, getDisplacementMap } = window.DisplacementUtils;
        element.style.borderRadius = `${this.radius}px`;

        if (this.autoSize) {
            element.style.backdropFilter = 'none';
            element.style.background = 'rgba(255, 255, 255, 0.4)';
            element.offsetWidth;
            element.offsetHeight;

            const rect = element.getBoundingClientRect();
            let actualWidth = Math.ceil(rect.width);
            let actualHeight = Math.ceil(rect.height);

            if (actualWidth === 0 || actualHeight === 0) {
                // A zero-sized/hidden lens is woken by ResizeObserver when it
                // becomes measurable. Polling it with RAF here kept an
                // invisible surface on the compositor every frame.
                return;
            }

            actualWidth = Math.max(actualWidth, this.minWidth);
            actualHeight = Math.max(actualHeight, this.minHeight);
            actualWidth = Math.max(actualWidth, 50);
            actualHeight = Math.max(actualHeight, 30);

            if (this.debug) {
                element.style.background = `url("${getDisplacementMap({
                    height: actualHeight,
                    width: actualWidth,
                    radius: this.radius,
                    depth: this.depth
                })}")`;
                element.style.boxShadow = 'none';
                element.style.backdropFilter = 'none';
            } else if (!this.hasSVGFilterSupport) {
                element.style.backdropFilter = `blur(${this.blur * 2}px)`;
                element.style.background = this.backgroundColor;
                element.style.boxShadow = 'var(--glass-element-shadow, 1px 1px 1px 0px rgba(255,255,255, 0.60) inset, -1px -1px 1px 0px rgba(255,255,255, 0.60) inset, 0px 0px 16px 0px rgba(0,0,0, 0.04))';
                element.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            } else {
                element.style.backdropFilter = `blur(${this.blur / 2}px) url('${getDisplacementFilter({
                    height: actualHeight,
                    width: actualWidth,
                    radius: this.radius,
                    depth: this.depth,
                    strength: this.strength,
                    chromaticAberration: this.chromaticAberration
                })}') blur(${this.blur}px) brightness(1.1) saturate(1.5)`;
                element.style.background = this.backgroundColor;
                element.style.boxShadow = 'var(--glass-element-shadow, 1px 1px 1px 0px rgba(255,255,255, 0.60) inset, -1px -1px 1px 0px rgba(255,255,255, 0.60) inset, 0px 0px 16px 0px rgba(0,0,0, 0.04))';
            }
        } else {
            element.style.height = `${this.height}px`;
            element.style.width = `${this.width}px`;

            if (this.debug) {
                element.style.background = `url("${getDisplacementMap({
                    height: this.height,
                    width: this.width,
                    radius: this.radius,
                    depth: this.depth
                })}")`;
                element.style.boxShadow = 'none';
                element.style.backdropFilter = 'none';
            } else if (!this.hasSVGFilterSupport) {
                element.style.backdropFilter = `blur(${this.blur * 2}px)`;
                element.style.background = this.backgroundColor;
                element.style.boxShadow = 'var(--glass-element-shadow, 1px 1px 1px 0px rgba(255,255,255, 0.60) inset, -1px -1px 1px 0px rgba(255,255,255, 0.60) inset, 0px 0px 16px 0px rgba(0,0,0, 0.04))';
                element.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            } else {
                element.style.backdropFilter = `blur(${this.blur / 2}px) url('${getDisplacementFilter({
                    height: this.height,
                    width: this.width,
                    radius: this.radius,
                    depth: this.depth,
                    strength: this.strength,
                    chromaticAberration: this.chromaticAberration
                })}') blur(${this.blur}px) brightness(1.1) saturate(1.5)`;
                element.style.background = this.backgroundColor;
                element.style.boxShadow = 'var(--glass-element-shadow, 1px 1px 1px 0px rgba(255,255,255, 0.60) inset, -1px -1px 1px 0px rgba(255,255,255, 0.60) inset, 0px 0px 16px 0px rgba(0,0,0, 0.04))';
            }
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: ${this.autoSize ? 'inline-block' : 'block'};
                }

                .glass-box {
                    background: rgba(255, 255, 255, 0.4);
                    box-shadow: 1px 1px 1px 0px rgba(255,255,255, 0.60) inset,
                                -1px -1px 1px 0px rgba(255,255,255, 0.60) inset,
                                0px 0px 16px 0px rgba(0,0,0, 0.04);
                    cursor: pointer;
                    transition: transform 0.1s ease;
                    position: relative;
                    ${this.autoSize ? `display: inline-block; width: fit-content; min-width: ${this.minWidth}px; min-height: ${this.minHeight}px;` : ''}
                }

                .glass-box:active {
                    transform: scale(0.98);
                }

                .content {
                    ${this.autoSize ? '' : 'width: 100%; height: 100%;'}
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    text-align: center;
                    font-family: sans-serif;
                    ${this.autoSize ? 'padding: var(--glass-padding, 16px 24px);' : ''}
                }
            </style>

            <div class="glass-box">
                <div class="content">
                    <slot></slot>
                </div>
            </div>
        `;

        const glassBox = this.shadowRoot.querySelector('.glass-box');
        if (this.autoSize) {
            this.scheduleFrame(() => {
                this.scheduleFrame(() => {
                    this.applyDynamicStyles(glassBox);
                });
            });
        } else {
            this.applyDynamicStyles(glassBox);
        }
    }
}

customElements.define('glass-element', GlassElement);
