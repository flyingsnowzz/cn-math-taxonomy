/**
 * 全局同步引擎单例 + 本地写入埋点。
 * 业务 store 在每次本地持久化后调用 markLocalChange(key)；
 * 合并进来的远端变更通过 window 事件广播，各 store 自行刷新。
 */
import { createSyncEngine } from './engine'
import { isSyncKey } from './merge'

export const SYNC_MERGED_EVENT = 'cnm:sync-merged'
export const SYNC_DIRTY_HOOK = '__cnmSyncDirty'

const engine = createSyncEngine({
  onRemoteMerged: (keys) => {
    window.dispatchEvent(new CustomEvent(SYNC_MERGED_EVENT, { detail: { keys } }))
  },
})

export const syncManager = {
  async login(): Promise<void> {
    await engine.login()
  },
  logout(): void {
    engine.logout()
  },
  markLocalChange(key: string): void {
    engine.markDirty(key)
  },
  flush(): Promise<void> {
    return engine.flush()
  },
  pull(): Promise<string[]> {
    return engine.pull()
  },
  isSyncKey,
}

/** legacy 非模块代码（children IIFE）通过此钩子上报本地写入。 */
export function installDirtyHook(): void {
  ;(window as unknown as Record<string, unknown>)[SYNC_DIRTY_HOOK] = (key: unknown) => {
    if (typeof key === 'string') syncManager.markLocalChange(key)
  }
}
