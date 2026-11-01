<script setup lang="ts">
import { getSubject } from '@/data/subjectRegistry'
import type { SubjectCode } from '@/data/types'
import BaseBadge from './BaseBadge.vue'

defineProps<{ subject: SubjectCode }>()
</script>

<template>
  <BaseBadge :color="getSubject(subject).graphColor">{{ getSubject(subject).label }}</BaseBadge>
</template>
