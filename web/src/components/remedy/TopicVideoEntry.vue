<script setup lang="ts">
import { computed } from 'vue'
import { formatDuration, videosForTopic, type TopicVideo } from '@/data/topicVideos'
import { track } from '@/utils/track'

const props = withDefaults(defineProps<{
  topicId: string
  /** card=紧凑小入口；panel=帮助面板里的主入口 */
  variant?: 'card' | 'panel'
}>(), { variant: 'panel' })

const videos = computed<TopicVideo[]>(() => videosForTopic(props.topicId))
const primary = computed<TopicVideo | null>(() => videos.value[0] ?? null)

const kindLabel: Record<TopicVideo['kind'], string> = {
  concept: '概念讲解',
  walkthrough: '例题精讲',
}

function onClick(video: TopicVideo) {
  track('video_open', { topic: props.topicId, kind: video.kind })
}
</script>

<template>
  <div v-if="primary" :data-test="'video-entry-' + topicId">
    <a
      v-if="variant === 'panel'"
      :href="primary.url"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
      data-test="video-entry-link"
      @click="onClick(primary)"
    >
      <span aria-hidden="true">▶</span>
      看视频讲解
      <span class="text-xs font-normal text-teal-100">{{ kindLabel[primary.kind] }}</span>
      <span v-if="formatDuration(primary.durationSec)" class="text-xs font-normal text-teal-100">
        · {{ formatDuration(primary.durationSec) }}
      </span>
    </a>
    <a
      v-else
      :href="primary.url"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
      data-test="video-entry-link"
      @click="onClick(primary)"
    >
      <span aria-hidden="true">▶</span> 视频讲解
      <span v-if="videos.length > 1" class="text-slate-400">等 {{ videos.length }} 个</span>
    </a>
  </div>
</template>
