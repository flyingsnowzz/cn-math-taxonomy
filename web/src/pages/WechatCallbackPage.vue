<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore, errorMessage } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const status = ref<'pending' | 'ok' | 'error'>('pending')
const error = ref('')

onMounted(async () => {
  const provider = route.params.provider === 'mp' ? 'mp' : 'open'
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  const state = typeof route.query.state === 'string' ? route.query.state : ''
  if (!code || !state) {
    status.value = 'error'
    error.value = '缺少微信授权参数，请重新登录'
    return
  }
  try {
    await auth.loginWithWechat(provider, code, state)
    status.value = 'ok'
    setTimeout(() => void router.push('/'), 600)
  } catch (e) {
    status.value = 'error'
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-16 text-center">
    <div v-if="status === 'pending'" class="text-sm text-slate-600" data-test="wechat-pending">
      正在完成微信登录…
    </div>
    <template v-else-if="status === 'ok'">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
      <p class="mt-3 font-semibold">登录成功</p>
    </template>
    <div v-else data-test="wechat-error">
      <p class="font-semibold text-red-700">微信登录失败</p>
      <p class="mt-1 text-sm text-slate-500">{{ error }}</p>
      <RouterLink
        to="/login"
        class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        返回登录
      </RouterLink>
    </div>
  </div>
</template>
