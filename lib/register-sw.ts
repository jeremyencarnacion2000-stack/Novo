// lib/register-sw.ts
// Registers the service worker for offline caching and push notifications

// API caching is intentionally disabled: Novo's private account data and Twin
// state must never be kept in browser-wide CacheStorage. Keep this cleanup
// during rollout so old novo-api-* caches are removed before an account switch.
export async function clearApiCache() {
    if (typeof window === 'undefined' || !('caches' in window)) return
    try {
        const keys = await caches.keys()
        await Promise.all(keys.filter((k) => k.startsWith('novo-api-')).map((k) => caches.delete(k)))
    } catch (err) {
        console.error('[SW] Failed to clear API cache on sign-out:', err)
    }
}

let registrationStarted = false
let serviceWorkerUpdateInterval: ReturnType<typeof setInterval> | null = null

export function registerServiceWorker() {
    if (typeof window === 'undefined' || registrationStarted) return
    registrationStarted = true

    if ('serviceWorker' in navigator) {
        // Without this, a new SW can finish activating (skipWaiting +
        // clients.claim) while the currently-open tab keeps running the
        // JS it already loaded into memory — the tab never picks up the
        // new version until the user manually reloads. The `refreshing`
        // guard prevents this firing twice and reload-looping.
        let refreshing = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return
            refreshing = true
            window.location.reload()
        })

        const register = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                })

                console.log('[SW] Registered with scope:', registration.scope)

                // Check for updates periodically (every 60 minutes). Stop the
                // timer entirely while the app is backgrounded instead of
                // waking every hour just to discover that the tab is hidden.
                const scheduleUpdateCheck = () => {
                    if (serviceWorkerUpdateInterval !== null || document.visibilityState === 'hidden') return
                    serviceWorkerUpdateInterval = setInterval(() => {
                        void registration.update()
                    }, 60 * 60 * 1000)
                }
                const handleVisibilityChange = () => {
                    if (document.visibilityState === 'visible') {
                        scheduleUpdateCheck()
                        void registration.update()
                    } else if (serviceWorkerUpdateInterval !== null) {
                        clearInterval(serviceWorkerUpdateInterval)
                        serviceWorkerUpdateInterval = null
                    }
                }
                document.addEventListener('visibilitychange', handleVisibilityChange)
                scheduleUpdateCheck()

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
        }

        if (document.readyState === 'complete') void register()
        else window.addEventListener('load', register, { once: true })
    }
}
