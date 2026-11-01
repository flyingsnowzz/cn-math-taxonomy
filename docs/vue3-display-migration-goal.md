# Vue 3 展示层迁移目标文档（Codex 目标模式）

> 状态：待人工验收（Vue 3 展示层功能与自动化验收已完成，预览部署和生产切换仍需授权）  
> 创建时间：2026-11-01 21:47（Asia/Shanghai）  
> 技术栈决策：Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS + TypeScript  
> 目标执行者：Codex  
> 迁移对象：当前静态网站的前端展示与交互层  

> 当前实施进展：新工程位于 `web/`，详细状态见 `web/README.md`。Python 数据构建脚本和 `data/` 正式内容未修改。
> 明确不动：知识图谱数据构建流程、Python 构建脚本、现有 JSON 数据生产方式

---

## 1. 目标概述

将当前基于**原生 HTML + 原生 CSS + 原生 JavaScript** 的网站展示层，迁移为基于 **Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS + TypeScript** 的前端应用，同时保持现有知识图谱数据、题库、课标、先修关系和数据构建流程不变。

本目标文档已按用户确认锁定前端基础栈：

```text
Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS + TypeScript
```

**TypeScript 为强制要求**：新前端工程使用 TypeScript 编写，所有 Vue 单文件组件使用 `<script setup lang="ts">`，业务模块、数据适配层、store、路由、工具函数必须具备明确类型。禁止在新代码中使用 `any` 规避类型；确需临时放宽时必须使用带注释的 `unknown`、泛型或局部类型收窄。

本阶段只做**展示层和前端交互层迁移**，不引入 Node.js 业务后端，不引入 PostgreSQL、MongoDB、Neo4j，也不改变知识图谱的构建方式。

迁移完成后：

- 现有静态 JSON 仍然是前端数据源；
- Python 脚本仍然负责生成和校验 `data/*.json`；
- Vue 3 应用负责首页、知识图谱浏览、诊断交互、孩子档案等页面；
- 现有网站功能应保持等价；
- 网站仍可纯静态部署到 Cloudflare Pages / GitHub Pages；
- 旧链接和主要分享 URL 应继续可用。

---

## 2. 当前系统现状

### 2.1 当前技术栈

| 层级 | 当前实现 |
|---|---|
| 页面 | 原生 HTML |
| 样式 | 原生 CSS |
| 前端逻辑 | 原生 JavaScript |
| 前端框架 | 无 Vue / React / Angular |
| 构建工具 | 前端无 Vite/Webpack 构建 |
| 图谱渲染 | Cytoscape.js + dagre + cytoscape-dagre |
| 数据格式 | 静态 JSON |
| 数据构建 | Python 3 脚本 |
| 本地存储 | localStorage、PWA Cache Storage |
| 部署方式 | Cloudflare Pages 静态部署 |

### 2.2 当前主要目录

| 路径 | 作用 |
|---|---|
| `index.html` | 首页 |
| `explore/` | 知识图谱浏览页 |
| `diagnose/` | 自适应诊断页与诊断引擎 |
| `children/` | 孩子档案、历史记录、备份恢复 |
| `assets/` | 全站 CSS、JS、图标、第三方前端库 |
| `data/` | 知识点、先修边、题目、课标等正式 JSON 数据 |
| `scripts/` | Python 数据构建、校验、题库核验、部署脚本 |
| `tests/` | 当前 Node.js 自动化测试 |
| `sw.js` | Service Worker 离线缓存 |
| `manifest.webmanifest` | PWA 清单 |

### 2.3 当前正式数据文件

Vue 3 首版只读取以下正式发布数据：

- `data/topics.json`
- `data/dependencies.json`
- `data/questions.json`
- `data/cn-curriculum-standards.json`
- `data/id-aliases.json`

以下内容仍为开发材料，不由新版学生端直接依赖：

- `data/_qbatches/`
- `data/_second_pass/`
- 大部分 `scripts/` 生成过程文件
- `screenshots/`

---

## 3. 迁移边界

## 3.1 本阶段必须保持不动的内容

未经审核确认，Codex 不得修改以下内容：

1. `scripts/` 下知识图谱构建逻辑；
2. `data/topics.json`、`data/dependencies.json`、`data/questions.json` 的业务内容；
3. 知识点 ID、先修边、题目 ID、课标 ID；
4. 学科 ID 前缀和诊断规则；
5. Python 数据校验和题库核验流程；
6. 现有数据生产模式：Python → JSON → 静态前端；
7. Cloudflare 生产环境配置；
8. 线上自定义域名和已发布站点。

如迁移过程中发现必须修改数据或构建脚本，应停止实现并记录为单独问题，等待审核，不应自行改数据。

## 3.2 本阶段允许修改或新增的内容

允许新增 Vue 3 前端工程，例如：

- `web/`：新的 Vue 3 应用；
- `web/src/`：Vue 组件、路由、状态、数据访问层；
- `web/package.json`：前端依赖和脚本；
- `web/tsconfig.json`：TypeScript 编译配置；
- `web/vite.config.ts`：Vite 配置；
- 新的前端单元测试和端到端测试；
- 后续静态部署脚本的 Vue 构建版本。

在新前端未验收前，保留当前根目录旧版页面，不直接破坏旧站点。

---

## 4. 推荐目标架构

```text
Python 数据构建脚本（保持不动）
        │
        ▼
data/*.json 正式静态数据（保持不动）
        │
        ▼
Vue 3 + Vite 前端应用
        │
        ├── 首页
        ├── 知识图谱浏览
        ├── 自适应诊断
        ├── 孩子档案与历史
        └── PWA / 本地缓存
        │
        ▼
Cloudflare Pages / GitHub Pages 静态部署
```

### 4.1 已确认技术选型

| 模块 | 选型 | 说明 |
|---|---|---|
| 前端框架 | Vue 3 | 使用 Composition API 和单文件组件 |
| 构建工具 | Vite | 负责开发服务器、构建、环境变量和静态资源处理 |
| 路由 | Vue Router | 承载首页、图谱、诊断、档案等页面路由和旧链接兼容 |
| 状态管理 | Pinia | 管理学科、图谱数据、诊断会话、孩子档案、UI 状态 |
| CSS 方案 | Tailwind CSS | 新组件优先使用原子类；旧版 CSS 可逐步迁移 |
| 图谱渲染 | 继续使用 Cytoscape.js + dagre | 第一阶段不替换为 AntV G6/Sigma/自研 Canvas |
| 单元测试 | Vitest | 与 Vite 工程集成，测试数据适配、store、引擎 adapter |
| 语言 | TypeScript（强制） | Vue SFC 使用 `<script setup lang="ts">`，数据模型、store、引擎适配必须类型化 |

建议新增依赖：

```bash
npm install vue vue-router pinia cytoscape dagre cytoscape-dagre
npm install -D typescript vite @vitejs/plugin-vue vue-tsc vitest jsdom @types/node @types/cytoscape @types/dagre tailwindcss @tailwindcss/vite
```

Cytoscape 和 dagre 优先使用 `@types/cytoscape`、`@types/dagre`；cytoscape-dagre 如缺少完整官方类型，需要在项目内维护最小可用的 `.d.ts` 声明，不允许因此退回 JavaScript。

> Tailwind CSS 建议在新项目中使用当前主版本（Tailwind CSS v4 方式）；如团队已有 v3 规范，也可在审核时明确锁定 v3。版本选择应在阶段 0 初始化前确定。

### 4.1.1 Tailwind CSS 使用原则

Tailwind 是本次展示层迁移的主 CSS 方案，但不能一次性无规则重写所有界面。要求：

1. 在 Vite 中通过 Tailwind 官方插件接入；
2. 将旧版主色、字号、间距、圆角、阴影、断点收敛为 Tailwind theme tokens；
3. 新增页面和组件优先使用 Tailwind utility class；
4. 旧版复杂 CSS 可先迁移为组件级 CSS，再逐步替换；
5. Cytoscape 节点、边、箭头等图形样式仍由 `graphStyles.ts` 管理，不强行用 Tailwind class 表达；
6. 诊断题卡、按钮、面板、导航等基础 UI 应建立项目内部组件，避免相同 utility class 在各页面大量复制；
7. 第一阶段目标是视觉连续，不借 Tailwind 迁移进行无审核的整体重设计。

建议基础组件：

```text
BaseButton.vue
BaseCard.vue
BaseBadge.vue
BaseTabs.vue
BaseModal.vue
BaseSearchInput.vue
SubjectBadge.vue
GradeChip.vue
EmptyState.vue
LoadingState.vue
ErrorState.vue
```

### 4.1.2 TypeScript 强制要求

所有新增前端源代码必须使用 TypeScript：

- Vue 组件统一使用 `<script setup lang="ts">`；
- Store 的 state、getter、action 必须有类型；
- API/JSON 数据必须通过 schema/type 收窄后才能进入业务状态；
- 路由 meta、本地存储读写、URL 参数解析必须声明类型；
- Cytoscape elements、布局配置、节点 data、边 data 要定义专用类型；
- 禁止将后端/静态 JSON 直接断言为业务类型，应做运行时校验或最小边界校验；
- 禁止普通业务代码使用 `any`；第三方库缺口使用局部声明；
- `npm run typecheck`（建议命令：`vue-tsc --noEmit`）必须作为构建和 CI 的必要步骤；
- TypeScript 配置建议开启 `strict: true`、`noUncheckedIndexedAccess: true`、`noImplicitOverride: true`。

推荐至少维护以下类型：

```text
Topic
DependencyEdge
Question
QuestionChoice
CurriculumStandard
SubjectCode
GraphNode
GraphEdge
DiagnosticSession
DiagnosticAnswer
DiagnosticSummary
ChildProfile
DiagnosticRecord
```

### 4.1.3 Pinia 状态划分

建议至少建立以下 store：

| Store | 职责 |
|---|---|
| `useSubjectStore` | 当前学科、学科注册表、学科主题色、ID 前缀 |
| `useGraphDataStore` | topics、edges、standards、aliases、加载状态、缓存 |
| `useQuestionStore` | 题库加载、按 topicId 索引、题目查询 |
| `useDiagnoseStore` | 诊断会话、答题状态、引擎结果、会话持久化 |
| `useChildrenStore` | 孩子档案、当前孩子、历史记录、备份恢复 |
| `useBlindspotsStore` | 本机薄弱点和错题汇总 |
| `useUiStore` | 导航、主题、侧边栏、全局 loading/error 状态 |

Store 中不直接写 DOM 操作；Cytoscape 实例只在图谱组件内部维护。

### 4.2 为什么第一阶段不换图谱库

当前项目已有可运行的 Cytoscape.js + dagre 图谱实现，且数据规模约 3,000 节点、4,000 多条边，现有图库完全可以承载。

本阶段目标是**框架迁移和结构现代化**，不是重做视觉风格。若同时迁移 Vue 3 和替换图谱库，会同时引入两类风险：

- Vue 组件化、路由、状态、构建风险；
- 图谱布局、交互、渲染差异风险。

因此第一阶段建议：

```text
先 Vue 3 组件化 + 保留 Cytoscape/dagre
后续再单独评估 AntV G6、X6、Sigma 或自定义 Canvas 星座图
```

AntV G6、星座式全图、自定义 Canvas、大规模 WebGL 图谱不作为本阶段交付内容。

---

## 5. 建议目录结构

在验收前，建议将新应用放在独立的 `web/` 目录，避免直接破坏旧版静态站点。

```text
cn-math-taxonomy/
├── data/                    # 保持不动：正式 JSON 数据
├── scripts/                 # 保持不动：Python 数据构建和校验
├── tests/                   # 旧前端/引擎测试，迁移期间继续保留
├── docs/
├── assets/                  # 旧版资源，迁移期保留
├── explore/                 # 旧版知识图谱页，迁移期保留
├── diagnose/                # 旧版诊断页，迁移期保留
├── children/                # 旧版档案页，迁移期保留
├── index.html               # 旧版首页，迁移期保留
└── web/                     # 新增 Vue 3 应用
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── postcss.config.js
    ├── public/
    │   ├── icons/
    │   └── favicon.svg
    └── src/
        ├── main.ts
        ├── App.vue
        ├── router/
        │   └── index.ts
        ├── stores/
        │   ├── subject.ts
        │   ├── graphData.ts
        │   ├── question.ts
        │   ├── diagnose.ts
        │   ├── children.ts
        │   ├── blindspots.ts
        │   └── ui.ts
        ├── data/
        │   ├── dataClient.ts
        │   ├── subjectRegistry.ts
        │   ├── schema.ts
        │   └── types.ts
        ├── engine/
        │   ├── diagEngine.ts
        │   └── engineAdapter.ts
        ├── layouts/
        │   └── DefaultLayout.vue
        ├── components/
        │   ├── base/
        │   │   ├── BaseButton.vue
        │   │   ├── BaseCard.vue
        │   │   ├── BaseBadge.vue
        │   │   └── ...
        │   ├── home/
        │   ├── graph/
        │   │   ├── KnowledgeGraph.vue
        │   │   ├── GraphToolbar.vue
        │   │   ├── GraphLegend.vue
        │   │   ├── TopicDetailPanel.vue
        │   │   ├── graphAdapter.ts
        │   │   ├── graphLayout.ts
        │   │   └── graphStyles.ts
        │   ├── diagnose/
        │   └── children/
        ├── pages/
        │   ├── HomePage.vue
        │   ├── ExplorePage.vue
        │   ├── DiagnosePage.vue
        │   ├── ChildrenPage.vue
        │   ├── ChildrenHistoryPage.vue
        │   └── NotFoundPage.vue
        ├── styles/
        │   ├── main.css
        │   └── tailwind.css
        └── utils/
            ├── storage.ts
            ├── share.ts
            └── url.ts
```

### 5.1 样式文件约定

使用 Tailwind CSS 后：

- `src/styles/main.css` 引入 Tailwind、定义 `@theme`、全局基础样式；
- 通用样式只保留 reset、排版、CSS 变量、焦点态、打印样式等；
- 页面布局优先在 Vue SFC 中使用 Tailwind class；
- 不把旧版 700 行 CSS 原样复制到所有组件；
- 与图谱画布有关且需要被 Cytoscape 读取的颜色，应从共享 theme token 或 `graphStyles.ts` 导出。

验收通过后，再决定是否：

1. 将 `web/` 构建产物作为唯一发布站点；
2. 把旧版根目录文件归档到 `legacy/`；
3. 更新部署脚本只发布 Vue 构建产物和正式 JSON。

## 6. 页面迁移范围

## 6.1 首页

旧入口：`index.html`

Vue 页面：`HomePage.vue`

需要保留：

- 项目介绍；
- 学科切换；
- 知识点、先修边、题目、课标数量统计；
- 年级/册次入口；
- 知识图谱入口；
- 诊断入口；
- 孩子档案入口；
- PWA 安装提示；
- 本机薄弱点展示（如保留该功能）。

实现要求：

- 首屏不应继续为了几个统计数字加载完整题库；
- 第一阶段可以暂时加载当前 JSON 保持功能等价；
- 但数据访问层必须封装，后续可无缝切换为构建时生成的 `stats.json` 或按学科分包接口。

## 6.2 知识图谱浏览页

旧入口：`explore/`

Vue 页面：`ExplorePage.vue`

需要保留：

- 学科切换；
- 学段、年级、领域筛选；
- 名称、章节、ID 搜索；
- 教材册章目录；
- 知识点列表；
- 当前节点详情；
- 课标条目展示；
- 样题展示；
- 向上 1 层、2 层、3 层和全部展开；
- hard / soft 边图例；
- 缩放、拖拽、适配画面；
- 点击节点切换选中项；
- 点击“诊断这个知识点”跳转诊断页。

图谱组件建议拆分：

```text
KnowledgeGraph.vue       # Cytoscape 容器和生命周期
graphAdapter.ts          # Topic/Edge → Cytoscape elements
graphLayout.ts           # dagre 布局配置
graphStyles.ts           # 节点、边、颜色、线型样式
GraphToolbar.vue         # 缩放、层级、适配画面
GraphLegend.vue          # 图例
TopicDetailPanel.vue     # 右侧详情
TopicSearchBox.vue       # 搜索框
```

要求：

- 第一阶段保持现有 Cytoscape + dagre；
- hard 边为实线，soft 边为虚线；
- 节点颜色语义与旧版一致或有明确迁移；
- 组件销毁时必须调用 Cytoscape 实例销毁方法，避免内存泄漏；
- 大数据量时默认仍展示局部图，不一次性铺开所有节点。

## 6.3 自适应诊断页

旧入口：`diagnose/`

Vue 页面：`DiagnosePage.vue`

需要保留：

- 学科选择；
- 知识点搜索；
- 教材章节目录；
- 单点诊断；
- 多目标诊断；
- 整章诊断；
- 整年级/整册筛查；
- 题量设置；
- 连续答对确认规则；
- 第一次答错后的基础题确认；
- 沿 hard/soft 先修回溯；
- 掌握、不稳、薄弱、未测状态；
- 根因分析；
- 学习路径；
- 路径图；
- 撤销上一题；
- 存档恢复；
- 演示模式；
- 诊断结果导出；
- 分享图；
- 打印结果。

核心原则：

> `diagnose/engine.js` 是当前诊断业务规则的核心，迁移时必须做到行为等价，不能借 Vue 重写顺手改变诊断算法。

建议步骤：

1. 先将 `diagnose/engine.js` 原样迁入 `src/engine/`，再包装为类型安全的 ES Module；
2. 保持现有 `tests/test_engine.js` 的测试用例通过；
3. 为建图、会话、题目、答案、总结结果定义 TypeScript interface/type；
4. 旧引擎如需短期保留 JS 源文件，应通过 `.d.ts` 和 adapter 隔离，新业务代码必须使用 TypeScript；
5. UI 组件只负责调用引擎，不在组件中复制诊断规则。

## 6.4 孩子档案与历史

旧入口：`children/`

Vue 页面：

- `ChildrenPage.vue`
- `ChildrenHistoryPage.vue`

需要保留：

- 多孩子档案；
- 当前孩子切换；
- 年级、教材版本等字段；
- 诊断历史；
- 学科筛选；
- 薄弱点汇总；
- JSON 备份导出；
- JSON 备份导入；
- 冲突合并；
- 异常文件拒绝；
- 存储失败处理。

要求：

- 第一阶段保持 localStorage key 和数据结构兼容；
- 用户已有本地档案不能因迁移丢失；
- 如必须调整 key，需要提供一次性迁移逻辑；
- 备份恢复相关行为必须通过测试。

## 6.5 PWA 和离线能力

需要保留：

- 可添加到桌面；
- 应用壳离线打开；
- 已访问数据可离线读取；
- 新版本缓存清理。

但不要求第一版完全照搬当前 `sw.js`。可采用：

- `vite-plugin-pwa`；或
- 自定义 Service Worker。

要求：

- 新旧缓存命名必须隔离；
- Vue 版本上线后不能错误复用旧版缓存导致白屏；
- 缓存版本可升级；
- 数据缓存策略要考虑后续 JSON 分包。

---

## 7. 路由和旧链接兼容

Vue Router 建议采用 history 模式。

### 7.1 新路由

| 路由 | 页面 |
|---|---|
| `/` | 首页 |
| `/explore/` | 知识图谱 |
| `/diagnose/` | 诊断 |
| `/children/` | 孩子档案 |
| `/children/history/` | 历史记录 |

### 7.2 必须兼容的 URL 形式

知识图谱：

```text
/explore/#cnm_221
/explore/?subject=english#cne_p001
/explore/?subject=physics#cnp_h001
/explore/?grade=...
/explore/?domain=...
```

诊断：

```text
/diagnose/?target=cnm_221
/diagnose/?target=cnm_221&demo=1
/diagnose/?subject=english&target=cne_p001
/diagnose/?subject=english&grade=四上
/diagnose/?subject=math&grade=七年级
/diagnose/?chapter=...
/diagnose/?volume=...
/diagnose/?seed=demo&limit=16
```

旧根路径 hash：

```text
/#cnm_221
/#cne_p001
/#cnp_001
/#cnc_p001
/#cns_p001
/#cnd_p001
/#cnh_j001
/#cng_j001
```

应自动跳转到对应学科的 `/explore/`。

静态部署需要配置 SPA fallback：

```text
/* /index.html 200
```

Cloudflare Pages 可使用 `_redirects`；如仍需兼容 GitHub Pages，应补充对应的 404 回退方案。

---

## 8. 数据访问设计

第一阶段保留当前 JSON 单体文件，但不能让 Vue 组件直接到处 `fetch()`。

必须建立统一数据访问层：

```ts
dataClient.loadSubjectGraph(subject: SubjectCode): Promise<SubjectGraph>
dataClient.loadAllGraph(): Promise<FullGraph>
dataClient.loadQuestions(subject?: SubjectCode): Promise<Question[]>
dataClient.loadStandards(): Promise<StandardMap>
dataClient.loadAliases(): Promise<AliasMap>
```

内部第一版可以读取：

```text
/data/topics.json
/data/dependencies.json
/data/questions.json
/data/cn-curriculum-standards.json
/data/id-aliases.json
```

但组件不得直接依赖这些具体路径。

这样后续可以在不改页面组件的情况下切换为：

```text
/data/math/topics.json
/data/english/topics.json
/data/physics/grades/g8a/questions.json
```

或未来切换为 Node API：

```text
/api/subjects/math/topics
/api/topics/:id/neighborhood
```

### 8.1 学科注册表

建立统一的 `subjectRegistry.ts`，集中维护：

- 学科代码；
- 中文名；
- ID 前缀；
- 主题色；
- 默认年级；
- 学段范围；
- 诊断 localStorage key；
- 图谱和诊断路由参数。

不能再在首页、图谱、诊断、档案页面中分散硬编码学科列表。

---

## 9. 本地存储兼容策略

第一阶段继续使用 localStorage，但要封装为类型安全的 `storage.ts`，禁止组件直接读写裸 key。

当前 key 包括：

| key | 内容 |
|---|---|
| `cnmDiagnose.session.v2` | 数学诊断会话 |
| `cneDiagnose.session.v2` | 英语诊断会话 |
| `cnpDiagnose.session.v2` | 物理诊断会话 |
| `cncDiagnose.session.v2` | 语文诊断会话 |
| `cnsDiagnose.session.v1` | 科学诊断会话 |
| `cndDiagnose.session.v1` | 道德与法治诊断会话 |
| `cnhDiagnose.session.v1` | 历史诊断会话 |
| `cngDiagnose.session.v1` | 地理诊断会话 |
| `cnmDiagnose.settings.v2` | 诊断设置 |
| `cnmChildren.v1` | 孩子档案 |
| `cnmChildren.records.v1` | 孩子诊断历史 |
| `cnmBlind.local.v1` | 本机薄弱点 |
| `cnmPwa.*` | PWA 提示状态 |

要求：

- 旧版数据可被新版读取；
- JSON 损坏时不能导致整站白屏；
- 存储不可用时进入降级模式；
- 后续迁移 IndexedDB 时只需替换 storage 层；
- 备份导入导出必须继续兼容现有 JSON 格式。

---

## 10. 样式与体验要求

第一阶段以“功能等价、结构清晰、视觉连续”为目标，使用 Tailwind CSS 重建组件样式，但不做无关注重设计。

要求：

1. 保留现有主色、卡片、按钮、学科色和基础布局；
2. 在 Tailwind theme 中定义颜色、字号、间距、圆角、阴影、断点；
3. 常用 UI 收敛为 `components/base/` 内部基础组件；
4. 移动端 375px 宽度下核心页面可用；
5. 触控目标不小于当前页面水平；
6. 知识图谱在窄屏下详情面板不遮挡主要操作；
7. 诊断题卡、选项按钮、结果页保持可读性；
8. 支持深色模式的页面，迁移后不应明显退化；
9. 不额外引入 Element Plus、Naive UI、Ant Design Vue 等重型组件库，除非另行审核；
10. Tailwind class 不得大面积复制难以维护的长串样式，重复模式必须抽组件或使用组合方法。

Tailwind 主要负责普通 DOM UI；Cytoscape 的节点/边样式继续通过 JS 样式表配置。

---

## 11. 测试与验收策略

## 11.1 必须继续通过的现有校验

在任何前端迁移提交后，以下命令仍应通过：

```bash
python3 scripts/validate.py
node tests/test_engine.js
node tests/test_children.js
node tests/test_blindspots.js
```

`test_children_browser.js` 依赖旧页面。迁移期可暂时保留旧页面运行该测试；旧页面删除前，需要为 Vue 新页面补齐等价浏览器测试。

## 11.2 新前端测试

建议新增：

```bash
cd web
npm run test
npm run typecheck
npm run build
npm run lint
```

测试范围：

- 学科注册表；
- 数据适配层；
- URL 参数解析；
- 旧链接跳转；
- 引擎 adapter；
- localStorage 兼容；
- 孩子备份导入导出；
- 图谱数据转换；
- 诊断结果状态计算。

## 11.3 核心 E2E 场景

至少覆盖：

1. 打开首页；
2. 切换数学、英语、物理等学科；
3. 搜索并打开 `cnm_221`（配方法）；
4. 图谱展示先修节点和 hard/soft 边；
5. 从图谱跳转诊断；
6. 运行演示模式：`/diagnose/?target=cnm_221&demo=1`；
7. 结果页出现掌握、不稳、薄弱、路径；
8. 手动答题、撤销、刷新恢复；
9. 孩子档案创建、切换、历史记录；
10. 备份导出再导入；
11. 375px 移动端无控制台致命错误；
12. PWA 构建通过。

---

## 12. 分阶段实施计划

## 阶段 0：迁移准备

目标：不改变旧网站，只建立工程基础。

任务：

- 新建 `web/` Vue 3 + Vite + TypeScript 工程；
- 配置 Vue Router、Pinia、Tailwind CSS、TypeScript 和基础样式；
- 配置 Vitest、ESLint/格式化工具；
- 配置 `tsconfig.json`、`tsconfig.node.json` 和 `vue-tsc --noEmit`；
- 配置本地开发读取根目录 `data/` 的方式；
- 建立学科注册表；
- 建立数据访问层；
- 建立 DefaultLayout 和占位页面。

验收：

- `npm run dev` 可启动新应用；
- `npm run build` 成功；
- 旧站点仍可正常运行；
- 不修改正式数据。

## 阶段 1：迁移诊断引擎和数据模型

目标：让 Vue 应用可以无展示偏差地复用当前诊断规则。

任务：

- 迁移或包装 `diagnose/engine.js`；
- 定义 Topic、Edge、Question、Standard、Session 等类型；
- 建立 JSON 加载和学科过滤；
- 将旧引擎测试迁移为 Vitest 或保留 Node 测试并保证通过；
- 封装 localStorage 会话读写。

验收：

- 与当前引擎行为一致；
- `vue-tsc` 类型检查通过，核心数据模型无 `any` 逃逸；
- `cnm_221` 演示诊断结果一致；
- 题目序列、状态、根因、学习路径一致；
- 引擎逻辑不依赖 Vue DOM。

## 阶段 2：迁移首页

目标：完成首页 Vue 化。

任务：

- 实现顶部导航和学科切换；
- 实现 Hero、三步说明、统计卡片；
- 实现年级/册次入口；
- 接入本机薄弱点区域；
- 保持旧路由跳转。

验收：

- 首页功能与旧版等价；
- 学科文案和入口无错误；
- 控制台无致命错误；
- 移动端布局可用。

## 阶段 3：迁移知识图谱浏览页

目标：用 Vue 组件重写 `explore/`，保留 Cytoscape + dagre。

任务：

- 实现搜索、筛选、目录和列表；
- 实现 `KnowledgeGraph.vue`；
- 迁移节点和边样式；
- 实现层级展开、缩放、适配、选中节点；
- 实现详情面板和诊断跳转；
- 保持 URL query/hash 双向同步。

验收：

- `cnm_221`、`cne_p001`、`cnp_*` 等学科节点能打开；
- hard/soft 线型正确；
- 局部图节点数和旧版逻辑一致；
- 图谱切换节点无明显性能问题；
- 旧 URL 可访问。

## 阶段 4：迁移诊断页

目标：完成诊断核心用户流程。

任务：

- 开始页、知识点选择、整章/整册筛查；
- 出题页、选择题/数值题输入；
- 判题、解析、状态展示；
- 回溯理由和进度条；
- 结果页、根因、路径、章节汇总；
- 撤销、存档恢复、演示模式；
- 分享图、导出、打印。

验收：

- 单点、多目标、整章、整册/整年级模式均可运行；
- 结果和旧版规则一致；
- localStorage 会话可恢复；
- 分享和导出不报错。

## 阶段 5：迁移孩子档案

目标：保留多孩子本地档案能力。

任务：

- 档案列表、编辑、当前孩子选择；
- 历史页、学科筛选；
- 薄弱点汇总；
- JSON 备份导出/导入；
- 冲突合并和异常处理；
- 接入诊断记录。

验收：

- 旧格式档案可读取；
- 新旧档案备份文件兼容；
- 损坏 JSON、超大文件、错误版本有明确提示；
- 现有备份恢复测试语义不丢失。

## 阶段 6：PWA、部署和旧站切换

目标：让 Vue 版本成为可发布静态站点。

任务：

- 配置 PWA manifest 和图标；
- 配置 Service Worker 缓存；
- 配置 Cloudflare Pages `_redirects`；
- 配置构建时复制正式 JSON；
- 新增 Vue 版部署脚本；
- 验证离线访问；
- 保留旧站点回滚方案。

验收：

- 构建产物可静态部署；
- 刷新深层路由不 404；
- 数据文件只打包正式发布文件，不包含 `_second_pass` 等开发材料；
- 新版可独立部署到预览环境；
- 生产切换前不自动部署。

---

## 13. 非功能要求

### 13.1 性能

第一阶段不强制解决全量 JSON 加载问题，但不能把架构写死。

最低要求：

- 数据加载必须有 loading 状态；
- JSON 加载失败有错误提示和重试；
- 图谱只渲染当前局部节点；
- 不在模板中重复执行大规模过滤；
- 大数据列表必须考虑搜索节流或 computed 缓存；
- 切换学科不应明显卡顿。

后续优化预留：

- 构建时 `stats.json`；
- 按学科/册次拆分 JSON；
- IndexedDB 缓存；
- 题包懒加载。

### 13.2 可维护性

要求：

- 页面组件不直接实现图算法；
- 诊断规则只存在于 engine 模块；
- 学科配置集中管理；
- API 路径集中在 dataClient；
- Cytoscape 生命周期封装在图谱组件内部；
- CSS 变量集中定义；
- 不用大量全局变量。

### 13.3 可访问性

要求：

- 主要按钮有可读文本；
- 搜索框有 label 或 aria-label；
- 图谱之外提供列表形式的知识点访问入口；
- 键盘用户可以通过列表完成核心操作；
- 颜色不能是唯一状态表达，线型和文字也要区分。

### 13.4 兼容性

优先支持：

- 最新版 Chrome / Edge / Safari；
- iOS Safari；
- Android Chrome；
- 桌面 1280px 宽；
- 移动端 375px 宽。

---

## 14. 明确不做的事情

本阶段不做：

1. 不引入 PostgreSQL；
2. 不引入 Neo4j；
3. 不引入业务后端；
4. 不做用户登录；
5. 不做班级和教师后台；
6. 不做云端同步；
7. 不改知识图谱构建脚本；
8. 不重算知识点先修边；
9. 不重排教材目录；
10. 不更换题库答案和诊断算法；
11. 不把 localStorage 直接升级为 IndexedDB；
12. 不替换为 AntV G6/Sigma/自定义 Canvas；
13. 不做星座式全课程大图；
14. 不自动部署到生产环境；
15. 不删除旧版页面，直到新版验收通过。

以上事项可以单独立项，不混入本次框架迁移。

---

## 15. 风险与应对

| 风险 | 说明 | 应对 |
|---|---|---|
| 诊断引擎行为迁移偏差 | Vue 重写时容易改变规则 | 先原样迁移引擎，用旧测试锁定行为 |
| 学科逻辑散落 | 各页面硬编码学科前缀和 key | 第一阶段建立统一 subjectRegistry |
| 旧链接失效 | Vue history 路由与静态托管刷新可能 404 | 配置 `_redirects` 和旧 hash 跳转 |
| 本地档案丢失 | localStorage 结构变化 | 保持 key/JSON 兼容并写迁移测试 |
| Cytoscape 与 Vue 生命周期冲突 | 重复初始化、内存泄漏、热更新异常 | 封装单一图谱组件，onUnmounted 销毁 |
| 全量 JSON 影响性能 | 当前题库较大 | 第一版接受现状，第二阶段分包 |
| PWA 缓存导致白屏 | 新旧 SW 缓存混用 | 新缓存命名隔离、版本升级和卸载策略 |
| 样式迁移范围膨胀 | 顺手重做 UI 导致验收困难 | 第一版保持视觉连续，重设计另立项 |
| 旧站被提前破坏 | 直接改根目录文件风险高 | Vue 新应用先放 `web/`，通过后再切换 |

---

## 16. Codex 执行规则

Codex 在开发时必须遵守：

1. 以本文档的验收标准作为完成定义；
2. 每个阶段独立提交，不跨阶段混改；
3. 优先做小步、可验证、可回滚的修改；
4. 不修改 `data/*.json` 的业务内容；
5. 不修改 `scripts/` 中的图谱构建逻辑；
6. 如果发现数据问题，只记录问题，不擅自修数据；
7. 保留旧版页面直到新版核心流程验收通过；
8. 每个阶段都要说明运行了哪些测试；
9. 不把 AntV G6、Node 后端、数据库、IndexedDB、登录系统等未来事项混入本次任务；
10. 不执行生产部署，除非用户另行明确授权；
11. 遇到与目标冲突的需求，先暂停并在回复中列出取舍；
12. 所有新增依赖必须说明用途，不能无理由引入大型 UI/图谱/工具库。

---

## 17. 完成定义（Definition of Done）

Vue 3 展示层迁移只有在以下条件全部满足时才算完成：

- [ ] 新 Vue 3 应用可在 `web/` 中独立启动和构建；
- [ ] 首页、知识图谱、诊断、孩子档案核心页面完成迁移；
- [ ] 旧版核心 URL 和分享链接可访问或正确跳转；
- [ ] 现有正式 JSON 数据无需修改即可被新版读取；
- [ ] 图谱仍正确展示节点、hard 边、soft 边和局部层级；
- [ ] 诊断引擎测试通过，关键诊断结果与旧版一致；
- [ ] 单点、整章、整册/整年级诊断流程可运行；
- [ ] localStorage 会话和孩子档案可迁移读取；
- [ ] 备份导入导出兼容；
- [ ] PWA 构建和离线策略通过验证；
- [ ] 桌面端和 375px 移动端核心流程可用；
- [ ] `python3 scripts/validate.py` 继续通过；
- [ ] 新前端单元测试、`vue-tsc` 类型检查、lint 和生产构建通过；
- [ ] 新版可部署到静态预览环境；
- [ ] 旧站点仍保留可回滚方案；
- [ ] 没有未经审核的数据结构、诊断规则或生产部署变更。

---

## 18. 需要用户审核确认的问题

以下问题建议在 Codex 开工前确认：

1. **迁移范围**：本阶段是否包含 `children/` 孩子档案，还是先只迁移首页和知识图谱浏览？
2. **诊断页范围**：是否第一阶段就迁移完整 `diagnose/`，还是先迁移图谱展示，诊断页第二阶段处理？
3. **Tailwind 版本**：默认使用 Tailwind CSS 当前主版本；如团队已有 v3 规范，需要在阶段 0 明确。
4. **TypeScript 严格度**：已确认强制 TypeScript；建议同时开启 `strict: true`、`noUncheckedIndexedAccess: true`。
5. **视觉策略**：第一版要求尽量贴近现有界面，仅允许在 Tailwind 组件化过程中做轻度间距和组件一致性优化。
6. **图谱库**：已确认第一阶段继续使用 Cytoscape.js + dagre，而不是改 AntV G6。
7. **新工程目录**：待确认是否同意新应用先放在 `web/`，验收后再替换根目录旧站点。
8. **PWA**：第一版是否必须完整保留离线能力，还是可以先保证网站功能、PWA 稍后补齐？
9. **部署目标**：第一阶段是否只产出本地/预览构建，不直接部署到 `math.pansgo.com`？
10. **无关入口**：首页中的智商测试、资源搜索、赞助等外部入口是否原样迁移、隐藏，还是暂不处理？
11. **后续方向**：本阶段是否明确坚持纯静态，不做 Vue 3 + Node API + PostgreSQL 的一体化改造？

---

## 19. 建议审核结论选项

用户审核时可选择以下任一方向：

### A. 按推荐方案执行

Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS + TypeScript，新应用放 `web/`，保留 Cytoscape.js，完整迁移首页、图谱、诊断、孩子档案，不引入后端和数据库。

### B. 先迁移最小展示范围

只迁移首页和 `explore/` 知识图谱浏览页；诊断、孩子档案、PWA 暂留旧版，后续再迁移。

### C. 先迁移诊断核心

优先迁移 `diagnose/` 和诊断引擎，知识图谱浏览页第二阶段处理。

### D. 同时升级图谱视觉

迁移 Vue 3 的同时评估 AntV G6 或自定义 Canvas 星座图。该方案风险最高，不建议作为第一版。

### E. 直接进入未来产品架构

一次性规划 Vue 3 + Node.js + PostgreSQL + 服务端诊断。该方案已超出“知识图谱构建维持不动”的本次边界，应另写目标文档。

---

## 20. 当前推荐

推荐选择 **方案 A 或方案 B**。

如果希望稳步替换现有网站：

> 选择方案 A：使用 Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS + TypeScript 完整迁移前端，但保留数据构建、图谱库、静态部署和诊断规则。

如果希望最快看到 Vue 3 图谱效果、降低首期风险：

> 选择方案 B：先迁移首页和知识图谱浏览页，确认视觉和组件架构后，再迁移诊断和孩子档案。

