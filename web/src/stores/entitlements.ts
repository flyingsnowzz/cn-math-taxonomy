import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { track } from '@/utils/track'

export const FEATURE_LABELS = {
  unlimited_practice: '不限量针对性练习',
  ai_explain: 'AI 讲解',
  report_detail: '家长报告详细版',
  multi_child: '多孩子档案',
  review_reminders: '完整复习提醒',
} as const

export type FeatureKey = keyof typeof FEATURE_LABELS

export const useEntitlementsStore = defineStore('entitlements', () => {
  const auth = useAuthStore()
  const activeFeature = ref<FeatureKey | null>(null)

  const isMember = computed(() => {
    const entitlement = auth.user?.entitlements
    if (!entitlement?.member) return false
    if (!entitlement.expireAt) return true
    const expires = Date.parse(entitlement.expireAt)
    return Number.isFinite(expires) && expires > Date.now()
  })

  function hasFeature(key: FeatureKey): boolean {
    return isMember.value && key in FEATURE_LABELS
  }

  /** 所有付费点统一走这里：会员放行，免费用户打开同一弹层并留埋点。 */
  function requestFeature(key: FeatureKey): boolean {
    if (hasFeature(key)) return true
    activeFeature.value = key
    track('paywall_view', { feature: key })
    return false
  }

  function closePaywall(): void {
    activeFeature.value = null
  }

  async function refresh(): Promise<void> {
    await auth.fetchMe()
    if (!isMember.value) activeFeature.value = null
  }

  return { activeFeature, isMember, hasFeature, requestFeature, closePaywall, refresh }
})
