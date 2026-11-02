<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { FEATURE_LABELS, useEntitlementsStore } from '@/stores/entitlements'

const entitlements = useEntitlementsStore()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && entitlements.activeFeature) entitlements.closePaywall()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="entitlements.activeFeature"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4"
      data-test="paywall-backdrop"
      @click.self="entitlements.closePaywall"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        class="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
        data-test="paywall-dialog"
      >
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-xl text-teal-700" aria-hidden="true">◇</div>
        <h2 id="paywall-title" class="mt-4 text-lg font-semibold text-slate-900">会员功能，即将开放</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          「{{ FEATURE_LABELS[entitlements.activeFeature] }}」正在准备中，敬请期待。
        </p>
        <button
          type="button"
          class="mt-5 w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
          data-test="paywall-close"
          autofocus
          @click="entitlements.closePaywall"
        >
          知道了
        </button>
      </section>
    </div>
  </Teleport>
</template>
