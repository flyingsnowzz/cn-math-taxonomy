// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { FEATURE_LABELS, useEntitlementsStore, type FeatureKey } from '../entitlements'
import { readEvents } from '@/utils/track'

function seedSession(member: boolean, expireAt: string | null = null) {
  localStorage.setItem('cnmAuth.v1', JSON.stringify({
    v: 1,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    user: {
      id: '7', phone: '13800000000', nickname: null,
      entitlements: { member, expireAt, source: 'manual' },
    },
  }))
}

describe('entitlements store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('免费用户的所有规划内功能都被统一拦截并记录埋点', () => {
    seedSession(false)
    const store = useEntitlementsStore()
    expect(store.isMember).toBe(false)
    for (const feature of Object.keys(FEATURE_LABELS) as FeatureKey[]) {
      expect(store.hasFeature(feature)).toBe(false)
      expect(store.requestFeature(feature)).toBe(false)
      expect(store.activeFeature).toBe(feature)
      store.closePaywall()
    }
    expect(readEvents().filter((event) => event.name === 'paywall_view')).toHaveLength(5)
  })

  it('真实会员解锁所有功能，未知键不能解锁', () => {
    seedSession(true)
    const store = useEntitlementsStore()
    for (const feature of Object.keys(FEATURE_LABELS) as FeatureKey[]) {
      expect(store.requestFeature(feature)).toBe(true)
    }
    expect(store.hasFeature('not_a_feature' as FeatureKey)).toBe(false)
    expect(store.activeFeature).toBeNull()
    expect(readEvents()).toHaveLength(0)
  })

  it('过期会员按免费处理', () => {
    seedSession(true, '2020-01-01T00:00:00Z')
    const store = useEntitlementsStore()
    expect(store.isMember).toBe(false)
    expect(store.hasFeature('report_detail')).toBe(false)
  })

  it('重新拉 /me 后从免费切换为会员', async () => {
    seedSession(false)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: '7', phone: '13800000000', nickname: null,
      entitlements: { member: true, expireAt: null, source: 'manual' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    const store = useEntitlementsStore()
    expect(store.isMember).toBe(false)
    await store.refresh()
    expect(store.isMember).toBe(true)
    expect(store.hasFeature('multi_child')).toBe(true)
  })
})
