import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import {
  SERVICE_WORKER_URL,
  cleanupLegacyDevelopmentServiceWorker,
  cleanupScopedServiceWorkers,
} from './utils/pwa'

await cleanupScopedServiceWorkers()
void cleanupLegacyDevelopmentServiceWorker()

createApp(App).use(createPinia()).use(router).mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(SERVICE_WORKER_URL.pathname).catch(() => {
    // Progressive enhancement: the app remains fully usable without offline support.
  })
}
