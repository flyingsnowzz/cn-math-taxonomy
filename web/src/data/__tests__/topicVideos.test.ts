// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  formatDuration,
  primaryVideo,
  saveCustomVideos,
  videosForTopic,
  type TopicVideo,
} from '../topicVideos'

const walkthrough: TopicVideo = {
  topicId: 'cnm_148',
  kind: 'walkthrough',
  title: '错题精讲',
  url: 'https://example.com/w',
  durationSec: 300,
}
const concept: TopicVideo = {
  topicId: 'cnm_148',
  kind: 'concept',
  title: '什么是完全平方公式',
  url: 'https://example.com/c',
  durationSec: 480,
}

describe('topicVideos', () => {
  beforeEach(() => localStorage.clear())

  it('默认（正式映射为空）：所有知识点都没有视频', () => {
    expect(videosForTopic('cnm_148')).toEqual([])
    expect(primaryVideo('cnm_148')).toBeNull()
  })

  it('本机自定义映射生效，concept 排在 walkthrough 前面', () => {
    saveCustomVideos({ cnm_148: [walkthrough, concept] })
    const list = videosForTopic('cnm_148')
    expect(list.map((v) => v.kind)).toEqual(['concept', 'walkthrough'])
    expect(primaryVideo('cnm_148')?.title).toBe('什么是完全平方公式')
  })

  it('坏数据与越界条目被忽略，不影响其他知识点', () => {
    localStorage.setItem(
      'cnmVideo.custom.v1',
      JSON.stringify({
        v: 1,
        videos: {
          cnm_148: [{ topicId: 'other', kind: 'concept', title: 'x', url: 'u' }, 'bad', { kind: 'x' }],
          cnm_221: [concept && { ...concept, topicId: 'cnm_221' }],
        },
      }),
    )
    expect(videosForTopic('cnm_148')).toEqual([])
    expect(primaryVideo('cnm_221')?.topicId).toBe('cnm_221')
  })

  it('时长格式化', () => {
    expect(formatDuration(300)).toBe('5 分钟')
    expect(formatDuration(undefined)).toBe('')
  })
})
