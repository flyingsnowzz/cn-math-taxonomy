<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/base/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isDev = import.meta.env.DEV
const isWechat = ref(false)
const tab = ref<'sms' | 'password'>('sms')
const phone = ref('')
const code = ref('')
const password = ref('')
const account = ref('')
const countdown = ref(0)
const sending = ref(false)
const submitting = ref(false)
const error = ref('')
const info = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const nextPath = computed(() => (typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : '/'))

function startCountdown() {
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

async function sendCode() {
  error.value = ''
  if (!/^1\d{10}$/.test(phone.value.replace(/[\s-]/g, ''))) {
    error.value = '请输入正确的手机号'
    return
  }
  sending.value = true
  try {
    const result = await auth.requestSmsCode(phone.value)
    startCountdown()
    info.value = isDev && result.devCode ? `开发环境验证码：${result.devCode}` : '验证码已发送，5 分钟内有效'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}

async function submitSms() {
  submitting.value = true
  error.value = ''
  try {
    await auth.loginWithSms(phone.value, code.value)
    void router.push(nextPath.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    submitting.value = false
  }
}

async function submitPassword() {
  submitting.value = true
  error.value = ''
  try {
    await auth.loginWithPassword(account.value, password.value)
    void router.push(nextPath.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    submitting.value = false
  }
}

async function wechatLogin() {
  error.value = ''
  const callback = `${window.location.origin}/login/callback/${isWechat.value ? 'mp' : 'open'}`
  const url = isWechat.value
    ? await auth.startWechatMp(callback)
    : await auth.startWechatOpen(callback)
  window.location.href = url
}

onMounted(() => {
  isWechat.value = /MicroMessenger/i.test(navigator.userAgent)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-10">
    <h1 class="text-xl font-semibold">登录 / 注册</h1>
    <p class="mt-1 text-sm text-slate-500">登录后可在多台设备同步补救计划与复习进度。不登录也可以直接使用诊断和练习。</p>

    <div class="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="mb-4 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl py-2 text-sm font-medium transition"
          :class="tab === 'sms' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'"
          @click="tab = 'sms'"
        >
          验证码登录
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl py-2 text-sm font-medium transition"
          :class="tab === 'password' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'"
          @click="tab = 'password'"
        >
          密码登录
        </button>
      </div>

      <form v-if="tab === 'sms'" class="space-y-3" @submit.prevent="submitSms">
        <input
          v-model="phone"
          type="tel"
          inputmode="numeric"
          autocomplete="tel"
          placeholder="手机号"
          class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
          data-test="login-phone"
        >
        <div class="flex gap-2">
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="6 位验证码"
            class="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
            data-test="login-code"
          >
          <BaseButton
            variant="secondary"
            :disabled="countdown > 0 || sending"
            type="button"
            @click="sendCode"
          >
            {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
          </BaseButton>
        </div>
        <BaseButton variant="primary" :disabled="submitting" type="submit" class="w-full">登录 / 注册</BaseButton>
      </form>

      <form v-else class="space-y-3" @submit.prevent="submitPassword">
        <input
          v-model="account"
          type="tel"
          autocomplete="username"
          placeholder="手机号"
          class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
          data-test="login-account"
        >
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="密码"
          class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
          data-test="login-password"
        >
        <BaseButton variant="primary" :disabled="submitting" type="submit" class="w-full">登录</BaseButton>
      </form>

      <p v-if="info" class="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800" data-test="login-info">{{ info }}</p>
      <p v-if="error" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800" data-test="login-error">{{ error }}</p>

      <div class="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span class="h-px flex-1 bg-slate-200" />或<span class="h-px flex-1 bg-slate-200" />
      </div>

      <BaseButton variant="secondary" class="w-full" data-test="login-wechat" @click="wechatLogin">
        {{ isWechat ? '微信一键登录' : '微信扫码登录' }}
      </BaseButton>
    </div>

    <RouterLink to="/" class="mt-4 block text-center text-sm text-slate-500 hover:text-slate-700">暂不登录，先逛逛</RouterLink>
  </div>
</template>
