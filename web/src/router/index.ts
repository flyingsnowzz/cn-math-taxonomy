import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
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

router.beforeEach((to) => (
  redirectLegacyFileRoute(to)
  ?? normalizeDiagnoseSubject(to)
  ?? redirectLegacyHash(to)
))
router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '知识图谱')} · 中小学知识图谱`
})

export default router
