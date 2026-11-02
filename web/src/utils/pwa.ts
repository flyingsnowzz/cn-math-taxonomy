export const SERVICE_WORKER_URL = new URL('sw.js', window.location.origin + import.meta.env.BASE_URL)
const ROOT_SCOPE = new URL(import.meta.env.BASE_URL, window.location.origin)

export async function cleanupScopedServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => {
      const isRootScope = registration.scope === ROOT_SCOPE.toString()
      return isRootScope ? Promise.resolve() : registration.unregister()
    }))
  } catch {
    // Browser may restrict Service Worker access in private/automation contexts.
  }
}

export async function cleanupLegacyDevelopmentServiceWorker(): Promise<void> {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))

    if (!('caches' in window)) return
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith('cnm-pwa-') || key.startsWith('cnm-vue-'))
        .map((key) => caches.delete(key)),
    )
  } catch {
    // Service Worker/Cache Storage can be unavailable in restricted browser contexts.
  }
}
