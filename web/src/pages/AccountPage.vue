<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import { useAuthStore } from '@/stores/auth'
import { FEATURE_LABELS, useEntitlementsStore, type FeatureKey } from '@/stores/entitlements'

const auth = useAuthStore()
const entitlements = useEntitlementsStore()
const loggingOut = ref(false)
const refreshing = ref(false)
const selectedFeature = ref<FeatureKey | null>(null)
const features = Object.keys(FEATURE_LABELS) as FeatureKey[]

async function refreshEntitlements() {
  if (!auth.isLoggedIn || refreshing.value) return
  refreshing.value = true
  try {
    await entitlements.refresh()
    if (!entitlements.isMember) selectedFeature.value = null
  } catch {
    // 令牌失效时由 API 层清会话；普通网络错误保留当前页面。
  } finally {
    refreshing.value = false
  }
}

function openFeature(feature: FeatureKey) {
  if (entitlements.requestFeature(feature)) selectedFeature.value = feature
}

onMounted(() => {
  void refreshEntitlements()
})

async function logout() {
  loggingOut.value = true
  await auth.logout()
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-8">
    <h1 class="text-xl font-semibold">账号设置</h1>

    <template v-if="auth.isLoggedIn">
      <BaseCard class="mt-5">
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-slate-500">手机号</dt>
            <dd>{{ auth.user?.phone || '未绑定' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-slate-500">昵称</dt>
            <dd>{{ auth.user?.nickname || '—' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-slate-500">会员状态</dt>
            <dd :class="entitlements.isMember ? 'text-emerald-700' : 'text-slate-500'" data-test="member-status">
              {{ entitlements.isMember ? '会员' : '免费版（会员功能即将开放）' }}
            </dd>
          </div>
        </dl>
        <div class="mt-5 flex gap-3">
          <BaseButton variant="secondary" :disabled="refreshing" data-test="refresh-entitlements" @click="refreshEntitlements">
            {{ refreshing ? '刷新中…' : '刷新权益' }}
          </BaseButton>
          <BaseButton variant="secondary" :disabled="loggingOut" @click="logout">退出登录</BaseButton>
        </div>
      </BaseCard>

      <BaseCard class="mt-5">
        <h2 class="font-semibold">会员功能</h2>
        <p class="mt-1 text-sm text-slate-500">会员开通状态以账号权益为准。</p>
        <div class="mt-4 grid gap-2">
          <button
            v-for="feature in features"
            :key="feature"
            type="button"
            class="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
            :data-test="`feature-${feature}`"
            @click="openFeature(feature)"
          >
            <span>{{ FEATURE_LABELS[feature] }}</span>
            <span class="text-xs" :class="entitlements.isMember ? 'text-emerald-700' : 'text-slate-400'">
              {{ entitlements.isMember ? '查看' : '即将开放' }}
            </span>
          </button>
        </div>
        <div
          v-if="selectedFeature"
          class="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
          data-test="member-feature-content"
        >
          <strong>{{ FEATURE_LABELS[selectedFeature] }}</strong>
          <p class="mt-1">会员内容已解锁，可在此继续使用该功能。</p>
        </div>
      </BaseCard>
    </template>

    <div v-else class="mt-5 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <p class="text-sm text-slate-600">登录后同步你的补救计划和复习进度。</p>
      <RouterLink
        to="/login"
        class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        去登录
      </RouterLink>
    </div>
  </div>
</template>
