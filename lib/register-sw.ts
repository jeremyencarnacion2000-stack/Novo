// lib/register-sw.ts
// Registers the service worker for offline caching and push notifications

export function registerServiceWorker() {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                })

                console.log('[SW] Registered with scope:', registration.scope)

                // Check for updates periodically (every 60 minutes)
                setInterval(() => {
                    registration.update()
                }, 60 * 60 * 1000)

                // Listen for new SW waiting to activate
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing
                    if (!newWorker) return

                    newWorker.addEventListener('statechange', () => {
                        if (
                            newWorker.state === 'installed' &&
                            navigator.serviceWorker.controller
                        ) {
                            // New version available — auto-activate
                            newWorker.postMessage({ type: 'SKIP_WAITING' })
                            console.log('[SW] New version installed, activating...')
                        }
                    })
                })
            } catch (error) {
                console.error('[SW] Registration failed:', error)
            }
        })
    }
}
