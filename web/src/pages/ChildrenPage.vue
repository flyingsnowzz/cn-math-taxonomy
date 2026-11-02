<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useChildrenStore, type ChildForm } from '@/stores/children'
import type { ChildrenBackup } from '@/children/legacy/children'

const childrenStore = useChildrenStore()
const editingId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const parsedBackup = ref<ChildrenBackup | null>(null)
const importError = ref('')
const exportError = ref('')
const exportStatus = ref('')
const MAX_BACKUP_BYTES = 10 * 1024 * 1024

const emptyForm: ChildForm = { name: '', grade: childrenStore.grades[0] ?? '', textbook: childrenStore.textbooks[0] ?? '' }
const form = reactive<ChildForm>({ ...emptyForm })

function resetForm() {
  Object.assign(form, emptyForm)
  editingId.value = null
  childrenStore.lastError = ''
}

function startEdit(id: string) {
  const child = childrenStore.children.find((item) => item.id === id)
  if (!child) return
  editingId.value = id
  form.name = child.name
  form.grade = child.grade
  form.textbook = child.textbook
}

function submit() {
  if (editingId.value) childrenStore.update(editingId.value, form)
  else childrenStore.add(form)
  if (!childrenStore.lastError) resetForm()
}

function removeChild(id: string) {
  const child = childrenStore.children.find((item) => item.id === id)
  if (!child) return
  if (window.confirm(`确定删除「${child.name}」的档案和本地诊断历史吗？`)) {
    childrenStore.remove(id)
    if (editingId.value === id) resetForm()
  }
}

async function onFileChange(event: Event) {
  importError.value = ''
  childrenStore.cancelImport()
  parsedBackup.value = null
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > MAX_BACKUP_BYTES) {
    importError.value = '备份文件不能超过 10 MB。'
    input.value = ''
    return
  }
  try {
    const text = await file.text()
    parsedBackup.value = childrenStore.parseBackupText(text)
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '备份文件无法读取'
    input.value = ''
  }
}

function confirmImport() {
  if (!parsedBackup.value) return
  try {
    childrenStore.confirmImport(parsedBackup.value)
    if (fileInput.value) fileInput.value.value = ''
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '导入失败'
  }
}

function exportBackup() {
  exportError.value = ''
  exportStatus.value = ''
  try {
    childrenStore.downloadBackup()
    exportStatus.value = '已生成备份文件，请在浏览器下载列表中查看。'
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : '导出失败'
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">孩子档案</h1>
        <p class="mt-1 text-sm text-slate-500">档案和诊断历史只保存在当前浏览器，可通过 JSON 文件备份或迁移。</p>
      </div>
      <RouterLink to="/children/history/" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
        查看诊断历史
      </RouterLink>
    </div>

    <div class="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold">已有档案（{{ childrenStore.children.length }} / 8）</h2>
          <button
            class="rounded-lg px-3 py-1.5 text-xs font-medium"
            :class="childrenStore.currentId ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-800'"
            disabled
          >
            {{ childrenStore.currentId ? '当前孩子已选择' : '尚无当前孩子' }}
          </button>
        </div>

        <div v-if="childrenStore.children.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          还没有孩子档案，请在右侧新增。
        </div>

        <div v-else class="grid gap-3 md:grid-cols-2">
          <article
            v-for="child in childrenStore.children"
            :key="child.id"
            class="rounded-2xl border p-4"
            :class="child.id === childrenStore.currentId ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-semibold">{{ child.name }}</h3>
                <p class="mt-1 text-xs text-slate-500">{{ child.grade }} · {{ child.textbook }}</p>
                <p class="mt-1 text-xs text-slate-400">{{ childrenStore.recordsOf(child.id).length }} 条本地诊断记录</p>
              </div>
              <span v-if="child.id === childrenStore.currentId" class="rounded-full bg-teal-700 px-2 py-1 text-[10px] font-semibold text-white">当前</span>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs hover:bg-slate-200" @click="childrenStore.setCurrent(child.id)">设为当前</button>
              <button class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs hover:bg-slate-200" @click="startEdit(child.id)">编辑</button>
              <RouterLink
                class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs hover:bg-slate-200"
                :to="{ path: '/children/history/', query: { child: child.id } }"
              >
                诊断记录
              </RouterLink>
              <button class="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100" @click="removeChild(child.id)">删除</button>
            </div>
          </article>
        </div>
      </section>

      <aside class="space-y-4">
        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 class="font-semibold">{{ editingId ? '编辑档案' : '新增档案' }}</h2>
          <div class="mt-4 space-y-3">
            <label class="block text-sm">
              <span class="mb-1 block font-medium text-slate-700">昵称</span>
              <input v-model="form.name" maxlength="12" class="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
            </label>
            <label class="block text-sm">
              <span class="mb-1 block font-medium text-slate-700">年级</span>
              <select v-model="form.grade" class="w-full rounded-xl border border-slate-200 px-3 py-2">
                <option v-for="grade in childrenStore.grades" :key="grade" :value="grade">{{ grade }}</option>
              </select>
            </label>
            <label class="block text-sm">
              <span class="mb-1 block font-medium text-slate-700">教材版本</span>
              <select v-model="form.textbook" class="w-full rounded-xl border border-slate-200 px-3 py-2">
                <option v-for="textbook in childrenStore.textbooks" :key="textbook" :value="textbook">{{ textbook }}</option>
              </select>
            </label>
          </div>
          <p v-if="childrenStore.lastError" class="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{{ childrenStore.lastError }}</p>
          <div class="mt-4 flex gap-2">
            <button class="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800" @click="submit">
              {{ editingId ? '保存修改' : '新增' }}
            </button>
            <button v-if="editingId" class="rounded-xl border border-slate-200 px-4 py-2 text-sm" @click="resetForm">取消</button>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 class="font-semibold">备份与迁移</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">导出包含多孩子资料和完整诊断历史，不包含未完成会话。导入前会先显示合并预览。</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" @click="exportBackup">导出全部档案</button>
            <label class="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              导入备份文件
              <input ref="fileInput" type="file" accept=".json,application/json" class="sr-only" @change="onFileChange">
            </label>
          </div>
          <p v-if="exportStatus" class="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">{{ exportStatus }}</p>
          <p v-if="exportError" class="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{{ exportError }}</p>
          <p v-if="importError" class="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{{ importError }}</p>

          <div v-if="childrenStore.importSummary && parsedBackup" class="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
            <p class="font-semibold">导入预览</p>
            <ul class="mt-2 space-y-1 text-xs text-slate-600">
              <li>新增孩子：{{ childrenStore.importSummary.addedChildren }}，重名改名：{{ childrenStore.importSummary.renamedChildren }}</li>
              <li>合并已有档案：{{ childrenStore.importSummary.matchedChildren }}</li>
              <li>新增记录：{{ childrenStore.importSummary.addedRecords }}，更新：{{ childrenStore.importSummary.updatedRecords }}，保留：{{ childrenStore.importSummary.keptRecords }}</li>
            </ul>
            <div class="mt-3 flex gap-2">
              <button class="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white" @click="confirmImport">确认合并导入</button>
              <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" @click="childrenStore.cancelImport(); parsedBackup = null">取消</button>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
