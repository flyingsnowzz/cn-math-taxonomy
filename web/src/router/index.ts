import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { syncRemedyFlag } from '@/utils/feature'
import {
  normalizeDiagnoseSubject,
  redirectLegacyFileRoute,
  redirectLegacyHash,
} from './legacyRoutes'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue'), meta: { title: '首页' } },
  {
    path: '/explore/',
    name: 'explore',
    component: () => import('@/pages/ExplorePage.vue'),
    alias: '/explore',
    meta: { title: '知识图谱' },
  },
  {
    path: '/diagnose/',
    name: 'diagnose',
    component: () => import('@/pages/DiagnosePage.vue'),
    alias: ['/diagnose', '/diagnose/index.html', '/diagnose.html'],
    meta: { title: '诊断' },
  },
  {
    path: '/remedy/',
    name: 'remedy',
    component: () => import('@/pages/RemedyPage.vue'),
    alias: ['/remedy', '/remedy/index.html', '/remedy.html'],
    meta: { title: '补救计划' },
  },
  {
    path: '/remedy/practice/:topicId',
    name: 'remedy-practice',
    component: () => import('@/pages/RemedyPracticePage.vue'),
    meta: { title: '针对性练习' },
  },
  {
    path: '/remedy/report',
    name: 'remedy-report',
    component: () => import('@/pages/RemedyReportPage.vue'),
    meta: { title: '提分报告' },
  },
  {
    path: '/remedy/review',
    name: 'remedy-review',
    component: () => import('@/pages/RemedyReviewPage.vue'),
    meta: { title: '今日复习' },
  },
  {
    path: '/remedy/shared',
    name: 'remedy-shared',
    component: () => import('@/pages/RemedySharedPage.vue'),
    meta: { title: '查漏补缺报告' },
  },
  {
    path: '/children/',
    name: 'children',
    component: () => import('@/pages/ChildrenPage.vue'),
    alias: ['/children', '/children/index.html', '/children.html'],
    meta: { title: '孩子档案' },
  },
  {
    path: '/children/history/',
    name: 'children-history',
    component: () => import('@/pages/ChildrenHistoryPage.vue'),
    alias: ['/children/history', '/children/history.html', '/children/history/index.html'],
    meta: { title: '诊断历史' },
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const search = to.fullPath.includes('?') ? `?${to.fullPath.split('?')[1]}` : ''
  syncRemedyFlag(search)
  return (
    redirectLegacyFileRoute(to)
    ?? normalizeDiagnoseSubject(to)
    ?? redirectLegacyHash(to)
  )
})
router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '知识图谱')} · 中小学知识图谱`
})

export default router
