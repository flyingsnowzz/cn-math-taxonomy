// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TopicVideoEntry from '../TopicVideoEntry.vue'
import { saveCustomVideos } from '@/data/topicVideos'

describe('TopicVideoEntry', () => {
  beforeEach(() => localStorage.clear())

  it('没有视频时完全不渲染', () => {
    const wrapper = mount(TopicVideoEntry, { props: { topicId: 'cnm_148' } })
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('[data-test="video-entry-link"]').exists()).toBe(false)
  })

  it('有视频时渲染外链按钮（panel），点击记 video_open 埋点', async () => {
    saveCustomVideos({
      cnm_148: [{
        topicId: 'cnm_148',
        kind: 'concept',
        title: '完全平方公式',
        url: 'https://video.example/cnm_148',
        durationSec: 480,
      }],
    })
    const wrapper = mount(TopicVideoEntry, { props: { topicId: 'cnm_148', variant: 'panel' } })
    const link = wrapper.get('[data-test="video-entry-link"]')
    expect(link.attributes('href')).toBe('https://video.example/cnm_148')
    expect(link.attributes('target')).toBe('_blank')
    expect(wrapper.text()).toContain('看视频讲解')
    expect(wrapper.text()).toContain('8 分钟')
    await link.trigger('click')
    const track = JSON.parse(localStorage.getItem('cnmTrack.v1') ?? '[]')
    expect(track.map((e: { name: string }) => e.name)).toContain('video_open')
  })

  it('card 变体为紧凑入口', () => {
    saveCustomVideos({
      cnm_148: [{ topicId: 'cnm_148', kind: 'walkthrough', title: '精讲', url: 'u' }],
    })
    const wrapper = mount(TopicVideoEntry, { props: { topicId: 'cnm_148', variant: 'card' } })
    expect(wrapper.text()).toContain('视频讲解')
  })
})
