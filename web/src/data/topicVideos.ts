/**
 * 知识点视频讲解注册框架。
 *
 * 设计目标：页面只依赖「某知识点有没有视频」，不关心视频从哪来。
 * 后续 AI Agent / 内容团队按 TopicVideo 结构填数据即可，无需改任何组件。
 *
 * 数据来源（后者覆盖前者同 id 条目）：
 * 1. PUBLISHED_VIDEOS：随版本发布的正式映射（目前为空，后续可改为构建期生成的 JSON）。
 * 2. localStorage `cnmVideo.custom.v1`：本机自定义映射，供内容预览与灰度；
 *    结构 { v:1, videos: Record<topicId, TopicVideo[]> }。
 */

export type TopicVideoKind = 'concept' | 'walkthrough'

export interface TopicVideo {
  topicId: string
  /** concept=知识点概念讲解；walkthrough=典型题/错题精讲 */
  kind: TopicVideoKind
  title: string
  /** 外链视频地址（如 B 站、自建点播）；以后接站内播放器时在这里扩展 */
  url: string
  provider?: string
  durationSec?: number
}

type VideoMap = Record<string, TopicVideo[]>

const CUSTOM_KEY = 'cnmVideo.custom.v1'

/**
 * 正式视频映射。M2 之前保持为空数组；接入内容时直接填这里，
 * 或把构建脚本生成的 JSON import 进来替换此常量。
 */
export const PUBLISHED_VIDEOS: VideoMap = {}

const KIND_RANK: Record<TopicVideoKind, number> = { concept: 0, walkthrough: 1 }

function isVideo(value: unknown): value is TopicVideo {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.topicId === 'string' &&
    (record.kind === 'concept' || record.kind === 'walkthrough') &&
    typeof record.title === 'string' &&
    typeof record.url === 'string'
  )
}

function readCustom(): VideoMap {
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const file = parsed as { v?: unknown; videos?: unknown }
    if (file.v !== 1 || typeof file.videos !== 'object' || file.videos === null) return {}
    const result: VideoMap = {}
    for (const [topicId, list] of Object.entries(file.videos as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue
      const valid = list.filter(isVideo).filter((video) => video.topicId === topicId)
      if (valid.length) result[topicId] = valid
    }
    return result
  } catch {
    return {}
  }
}

/** 合并正式映射与本机自定义（自定义优先），按 concept→walkthrough 排序。 */
export function videosForTopic(topicId: string): TopicVideo[] {
  const merged = [...(PUBLISHED_VIDEOS[topicId] ?? []), ...readCustom()[topicId] ?? []]
  return merged.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])
}

/** 首选视频：概念讲解优先。 */
export function primaryVideo(topicId: string): TopicVideo | null {
  return videosForTopic(topicId)[0] ?? null
}

/** 供内容预览工具写入本机自定义映射。 */
export function saveCustomVideos(map: VideoMap): void {
  window.localStorage.setItem(CUSTOM_KEY, JSON.stringify({ v: 1, videos: map }))
}

export function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return ''
  const min = Math.round(seconds / 60)
  return min < 60 ? `${min} 分钟` : `${Math.floor(min / 60)} 小时 ${min % 60} 分`
}
