<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'cnmPwa.dismissed.v1'
const INSTALLED_KEY = 'cnmPwa.installed.v1'

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const dismissed = ref(false)
const showIosGuide = ref(false)

const isStandalone = computed(() =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
)
const isIos = computed(() => /iPhone|iPad|iPod/i.test(navigator.userAgent))
const canInstall = computed(() => !dismissed.value && !isStandalone.value && (deferredPrompt.value !== null || isIos.value))

function persistDismissed() {
  dismissed.value = true
  try { localStorage.setItem(DISMISS_KEY, new Date().toISOString()) } catch { /* private mode */ }
}

async function install() {
  if (deferredPrompt.value) {
    await deferredPrompt.value.prompt()
    const choice = await deferredPrompt.value.userChoice
    if (choice.outcome === 'accepted') {
      try { localStorage.setItem(INSTALLED_KEY, '1') } catch { /* private mode */ }
    }
    deferredPrompt.value = null
    persistDismissed()
  } else {
    showIosGuide.value = true
  }
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  deferredPrompt.value = event as BeforeInstallPromptEvent
}

function onAppInstalled() {
  deferredPrompt.value = null
  try { localStorage.setItem(INSTALLED_KEY, '1') } catch { /* private mode */ }
  persistDismissed()
}

onMounted(() => {
  try {
    dismissed.value = Boolean(localStorage.getItem(DISMISS_KEY)) || localStorage.getItem(INSTALLED_KEY) === '1'
  } catch {
    dismissed.value = false
  }
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.removeEventListener('appinstalled', onAppInstalled)
})
</script>

<template>
  <div
    v-if="canInstall"
    class="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-5"
    role="region"
    aria-label="添加到桌面"
  >
    <div class="flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-slate-900">添加到桌面</p>
        <p class="mt-0.5 text-xs leading-5 text-slate-500">
          像 App 一样全屏打开；首次访问后也可离线浏览已缓存的学科数据。
        </p>
      </div>
      <button class="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800" @click="install">
        {{ isIos ? '怎么添加' : '添加' }}
      </button>
      <button class="rounded-lg px-2 py-2 text-xs text-slate-500 hover:bg-slate-100" @click="persistDismissed">暂不</button>
    </div>
    <div v-if="showIosGuide" class="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
      在 Safari 中点击底部“分享”按钮，向上滑动并选择“添加到主屏幕”，再点击“添加”。
      <button class="ml-2 font-semibold text-teal-700" @click="showIosGuide = false">知道了</button>
    </div>
  </div>
</template>
