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
import { installDirtyHook } from './sync'
import { useAuthStore } from './stores/auth'

await cleanupScopedServiceWorkers()
void cleanupLegacyDevelopmentServiceWorker()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 云同步：legacy 模块通过 window 钩子上报写入；已登录则启动同步
installDirtyHook()
useAuthStore().initSyncIfLoggedIn()

app.mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(SERVICE_WORKER_URL.pathname).catch(() => {
    // Progressive enhancement: the app remains fully usable without offline support.
  })
}
