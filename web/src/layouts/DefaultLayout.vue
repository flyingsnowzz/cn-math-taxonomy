<script setup lang="ts">
import PaywallDialog from '@/components/entitlements/PaywallDialog.vue'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSubjectStore } from '@/stores/subject'
import { useAuthStore } from '@/stores/auth'
import PwaInstall from '@/components/PwaInstall.vue'
import { normalizeSubject } from '@/data/subjectRegistry'

const route = useRoute()
const subjectStore = useSubjectStore()
const authStore = useAuthStore()
const currentSubject = computed(() => normalizeSubject(route.query.subject))
subjectStore.setSubject(currentSubject.value)

const nav = [
  { to: '/', label: '首页' },
  { to: '/explore/', label: '知识图谱' },
  { to: '/diagnose/', label: '诊断' },
  { to: '/children/', label: '档案' },
]
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-[1600px] items-center gap-5 px-4 sm:px-6">
        <RouterLink to="/" class="flex items-center gap-3 font-semibold">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-lg text-white">∑</span>
          <span>
            <span class="block text-[15px] leading-tight">中小学知识图谱</span>
            <span class="block text-xs font-normal text-slate-500">Vue 3 迁移版</span>
          </span>
        </RouterLink>

        <nav class="ml-4 hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            active-class="bg-teal-50 text-teal-800"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-3">
          <RouterLink v-if="!authStore.isLoggedIn" to="/login" class="text-sm font-medium text-slate-600 hover:text-teal-800" data-test="nav-login">
            登录
          </RouterLink>
          <RouterLink v-else to="/account" class="text-sm font-medium text-slate-600 hover:text-teal-800" data-test="nav-account">
            {{ authStore.displayName }}
          </RouterLink>
        </div>

        <div class="ml-auto flex items-center gap-2 md:ml-2">
          <RouterLink
            v-for="subject in subjectStore.subjects"
            :key="subject.code"
            :to="{ path: '/explore/', query: { subject: subject.code } }"
            class="hidden rounded-full px-3 py-1.5 text-xs font-medium transition lg:inline-flex"
            :class="subject.code === currentSubject
              ? 'bg-teal-700 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          >
            {{ subject.label }}
          </RouterLink>
        </div>
      </div>
    </header>
    <PwaInstall />
    <PaywallDialog />
    <main class="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <slot />
    </main>
  </div>
</template>
