/**
 * 补救闭环灰度开关（T1.5）。
 *
 * 默认开启；URL 带 ?remedy=0 关闭并记住，?remedy=1 重新开启。
 * 关闭时诊断页 CTA、首页入口与补救路由入口隐藏，站点行为与 M0 之前一致。
 */

const FLAG_KEY = 'cnmFeature.remedy.v1'

export function syncRemedyFlag(search: string): boolean {
  const params = new URLSearchParams(search)
  const query = params.get('remedy')
  if (query === '0' || query === '1') {
    const enabled = query === '1'
    try {
      window.localStorage.setItem(FLAG_KEY, enabled ? '1' : '0')
    } catch {
      // ignore
    }
    return enabled
  }
  return remedyEnabled()
}

export function remedyEnabled(): boolean {
  try {
    return window.localStorage.getItem(FLAG_KEY) !== '0'
  } catch {
    return true
  }
}
