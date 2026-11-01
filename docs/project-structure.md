# 项目目录结构说明

> 更新时间：2026-11-01  
> 适用仓库：`cn-math-taxonomy`

## 1. 项目定位

本项目是一个面向中小学和高中阶段的**多学科知识图谱与自适应诊断静态网站**。仓库名虽然仍叫 `cn-math-taxonomy`，但当前已覆盖：

- 数学；
- 语文；
- 英语；
- 物理；
- 科学；
- 道德与法治；
- 历史；
- 地理。

系统的核心能力是：

1. 用知识点节点和先修边表达课程知识结构；
2. 在网页中浏览局部知识图谱；
3. 从目标知识点开始出题；
4. 学生答错后沿先修关系继续回溯；
5. 输出薄弱根因、不稳定知识点和建议学习路径。

当前线上形态是**纯静态 Web 应用**：

```text
Python 脚本生成/校验图谱数据
        ↓
data/*.json 静态数据
        ↓
HTML + CSS + 原生 JavaScript
        ↓
Cloudflare Pages / GitHub Pages
```

当前没有在线后端、数据库和服务端渲染。

---

## 2. 当前技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 页面 | 原生 HTML | 无 Vue/React/Angular |
| 样式 | 原生 CSS | 全站样式和各页面样式分离 |
| 前端逻辑 | 原生 JavaScript | 无前端打包构建流程 |
| 图谱可视化 | Cytoscape.js + dagre + cytoscape-dagre | 本地 vendored，不走 CDN |
| 二维码 | qrcode-generator | 用于诊断分享图 |
| 离线能力 | PWA + Service Worker | `sw.js` + `manifest.webmanifest` |
| 图谱数据 | JSON | 节点、边、题目、课标均为静态 JSON |
| 数据构建 | Python 3 | 学科内容脚本、编译脚本、校验脚本 |
| 自动化测试 | Node.js 内置能力 | 无第三方测试框架 |
| 部署 | Cloudflare Pages | 使用 Wrangler 打包静态文件 |

---

## 3. 顶层目录总览

```text
cn-math-taxonomy/
├── .github/              # GitHub Issue 模板
├── assets/               # 全站共享 CSS、JS、图标、第三方前端库
├── children/             # 孩子档案、诊断历史、备份恢复页面
├── data/                 # 正式图谱数据、题库、课标、构建批次和复核材料
├── diagnose/             # 自适应诊断工具
├── docs/                 # 项目设计、数据、题库、PWA 等说明文档
├── explore/              # 知识图谱浏览页面
├── screenshots/          # 页面截图、冒烟测试截图、配图
├── scripts/              # Python 构建/校验脚本、Node 截图脚本、部署脚本
├── tests/                # Node.js 自动化测试
├── .gitignore
├── .nojekyll             # GitHub Pages 关闭 Jekyll 处理
├── CHANGELOG.md          # 变更记录
├── LICENSE               # 许可证
├── README.md             # 项目主说明
├── index.html            # 网站首页
├── manifest.webmanifest  # PWA 清单
├── package.json          # Node 项目元信息，当前不承担前端构建
└── sw.js                 # Service Worker，离线缓存
```

---

## 4. 根目录文件说明

### `index.html`

网站首页。负责：

- 项目介绍；
- 学科与年级入口；
- 首页统计展示；
- 跳转知识图谱、诊断和孩子档案；
- 根据 URL hash 中的旧知识点 ID 跳转到对应学科图谱。

首页逻辑主要在 `assets/home.js`，样式主要在 `assets/site.css`。

### `sw.js`

PWA Service Worker。负责：

- 预缓存页面壳、脚本、样式、图标和第三方库；
- 缓存 `data/` 下的正式 JSON；
- 网络优先与缓存回退；
- 静态资源的 stale-while-revalidate；
- 新版本缓存清理。

> 注意：当前缓存粒度是整份正式 JSON，后续数据规模继续扩大时建议改为按学科、册次分包缓存。

### `manifest.webmanifest`

PWA 应用清单，包含：

- 应用名称；
- 图标；
- 主题色；
- 启动方式；
- 展示模式等。

### `package.json`

Node 项目元信息文件。当前：

- 没有使用 Vite、Webpack、React 或 Vue；
- 没有有效 `npm test` 脚本；
- 测试需要直接运行 `node tests/*.js`；
- 部署时通过 `npx wrangler` 临时调用 Cloudflare Wrangler。

### `README.md`

项目最大的说明文档，包含：

- 覆盖范围；
- 数据来源与限制；
- 学科统计；
- 图谱和诊断规则；
- 本地运行方式；
- 题库与课标说明；
- Cloudflare Pages 部署方式。

### `CHANGELOG.md`

按日期记录内容、ID、题库、页面和数据结构变化。

### `.nojekyll`

告诉 GitHub Pages 不要使用 Jekyll 构建，避免静态目录和以下划线开头的数据目录被忽略。

---

## 5. `assets/`：全站共享资源

`assets/` 存放跨页面共用的前端资源。

```text
assets/
├── blindspots.js          # 本机错题/薄弱点汇总
├── children.js            # 孩子档案与备份恢复通用逻辑
├── explore.css            # 知识图谱页样式
├── home.js                # 首页学科切换、统计、年级入口
├── pwa.css                # PWA 安装提示样式
├── pwa.js                 # PWA 安装和提示逻辑
├── site.css               # 全站基础样式
├── stats-config.js        # 统计钩子配置，默认不发起统计请求
├── stats.js               # 可选访问统计封装
├── icons/                 # PWA 图标
├── sponsor/               # 赞助/微信收款等图片
└── vendor/                # 第三方前端库及许可证
```

### 关键 JS 文件

| 文件 | 作用 |
|---|---|
| `home.js` | 加载正式 JSON，计算首页知识点、边、题目、课标数量，并生成年级入口 |
| `children.js` | 多孩子档案、当前孩子、诊断历史、JSON 备份导入导出 |
| `blindspots.js` | 汇总本机薄弱点、不稳点、未完成会话中的错题 |
| `pwa.js` | PWA 安装提示、iOS 提示、安装状态记录 |
| `stats.js` | 可选统计事件；默认配置为空，不收集数据 |
| `stats-config.js` | Cloudflare Analytics 或自建统计 endpoint 配置 |

### `assets/vendor/`

第三方库直接入库，无需 npm 安装：

| 文件 | 作用 |
|---|---|
| `cytoscape.min.js` | 图可视化主库 |
| `dagre.min.js` | DAG 层级布局算法 |
| `cytoscape-dagre.js` | Cytoscape 调用 dagre 布局的插件 |
| `qrcode.js` | 生成诊断分享图二维码 |
| `VENDOR.md`、`LICENSE-*` | 第三方库说明和许可证 |

---

## 6. `data/`：正式图谱数据与生成过程材料

`data/` 是项目最重要的数据目录。

```text
data/
├── topics.json                   # 知识点节点
├── dependencies.json             # 先修边
├── questions.json                # 题库
├── cn-curriculum-standards.json  # 课程标准条目
├── id-aliases.json               # 旧 ID 到新 ID 的兼容映射
├── verification_report.json      # 题库答案自动核验报告
├── second_pass_log.json          # 第二轮题库复核记录
├── _distractor_changelog.json    # 干扰项修订记录
├── _qbatches/                    # 早期题目生成批次
├── _second_pass/                 # 第二轮独立解题和比对材料
└── mappings/                     # 教材版本映射
```

### 6.1 `topics.json`：知识点节点

正式知识点数组。每个节点包含：

- `id`：稳定知识点 ID；
- `name`：名称；
- `subject` 或通过 ID 前缀表达的学科；
- `domain`：领域；
- `grade`、`semester`、`chapter`：年级、学期、教材章节；
- `type`：知识点类型；
- `description`：简介；
- `mastery_criteria`：掌握标准；
- `diagnostic_question`：早期单题诊断字段；
- `standards`：对应课程标准条目；
- `external`：是否为外部/不可测节点。

常见 ID 前缀：

| 前缀 | 学科 |
|---|---|
| `cnm_` | 数学 |
| `cne_` | 英语 |
| `cnp_` | 物理 |
| `cnc_` | 语文 |
| `cns_` | 科学 |
| `cnd_` | 道德与法治 |
| `cnh_` | 历史 |
| `cng_` | 地理 |

### 6.2 `dependencies.json`：先修边

每条边表示某个知识点依赖一个先修知识点：

```json
{
  "topicId": "cnm_p002",
  "prerequisiteId": "cnm_p001",
  "strength": "hard",
  "reason": "学习后一个知识点需要先掌握前一个知识点。"
}
```

`strength` 分两类：

- `hard`：强依赖、必要先修；
- `soft`：建议学习顺序或弱依赖。

诊断时优先回溯 `hard` 边，再回溯 `soft` 边。

### 6.3 `questions.json`：题库

所有诊断题的正式发布文件。每道题关联一个 `topicId`，并包含：

- 题型；
- 难度；
- 题干；
- 选项；
- 答案；
- 解析；
- 自动核验表达式 `verify`；
- 可选配图、单位、接受答案等。

主要题型：

- `choice`：选择题；
- `numeric`：数值题；
- `short`：短答题；
- `self`：自评题。

### 6.4 `cn-curriculum-standards.json`：课程标准

包含多个学科的课程标准来源信息和条目列表。知识点通过 `topics.json` 中的 `standards` 字段引用课标 ID。

映射可信度分：

- `exact`：较直接对应；
- `inferred`：推断映射，需要教研审核。

### 6.5 `id-aliases.json`

旧知识点 ID 的兼容跳转表。例如某些早期 `cnm_ext_*` 节点删除后，旧链接仍可通过该文件跳转到正式知识点。

### 6.6 `verification_report.json` 与 `second_pass_log.json`

- `verification_report.json`：题目答案自动核验报告；
- `second_pass_log.json`：第二轮独立解题、差异比对与修正记录。

它们用于追溯题库质量，不直接参与页面核心功能。

### 6.7 `_qbatches/`

早期题库生成批次，例如：

- 小学数学各年级批次；
- 高中必修批次；
- 高中选择性必修批次。

这些文件主要用于追溯和比对，不是页面运行时的正式数据源。

### 6.8 `_second_pass/`

第二轮题库复核材料，包括：

- 题目批次；
- 独立答案；
- 解题笔记；
- 不一致记录；
- 复核说明。

该目录主要供维护者审计题库，不部署到线上核心数据包。

### 6.9 `mappings/`

教材版本映射目录，用于描述同一知识点在其他教材版本中的位置。当前包含示例和部分映射数据。

---

## 7. `explore/`：知识图谱浏览页

```text
explore/
├── index.html
└── app.js
```

### 功能

- 学科、年级、领域筛选；
- 搜索知识点；
- 按章节浏览；
- 使用 Cytoscape.js 展示局部知识图谱；
- 显示知识点详情、掌握标准、课标和样题；
- 支持向上 1/2/3 层和全部关系展开；
- 跳转到对应知识点诊断。

### 技术特点

- 加载 `topics.json`、`dependencies.json`、`cn-curriculum-standards.json`、`id-aliases.json`；
- 按需加载题库用于展示样题；
- 在浏览器中筛选当前学科；
- 使用 dagre 进行层级布局；
- 实线表示硬先修，虚线表示软先修。

---

## 8. `diagnose/`：自适应诊断工具

```text
diagnose/
├── index.html    # 诊断页面结构
├── style.css     # 诊断页样式
├── engine.js     # 纯函数诊断引擎
├── app.js        # 页面交互、数据加载、localStorage、结果渲染
├── share.js      # 诊断分享图和二维码
└── README.md     # 诊断工具说明
```

### `engine.js`

项目最核心的业务逻辑文件，特点是：

- 无 DOM；
- 无第三方依赖；
- 浏览器和 Node.js 都可运行；
- 可单元测试；
- 负责图构建、出题、判题、状态更新和结果总结。

核心流程：

```text
buildGraph()
  ↓
createSession()
  ↓
nextItem()
  ↓
applyAnswer()
  ↓
summarize()
```

主要能力：

- 建立先修和后续邻接表；
- 判断节点是否可测；
- 按难度和伪随机种子选题；
- 支持连续答对确认掌握；
- 第一次答错后给更基础的确认题；
- 连续错误时沿先修边回溯；
- 输出薄弱、不稳、掌握、未测、根因和学习路径；
- 支持单点、整章、整册、整年级筛查；
- 内置选择题、数值题、短答题和自评题判题逻辑。

### `app.js`

诊断页面的 UI 和应用层，负责：

- 加载正式 JSON；
- 根据 `subject` 参数筛选学科；
- 解析 URL 参数；
- 渲染开始页、出题页、结果页；
- localStorage 存档和恢复；
- 题量设置；
- 诊断结果打印、导出和分享；
- 调用 Cytoscape 绘制学习路径图。

### `share.js`

使用 Canvas 生成竖版分享图，并通过本地 `qrcode.js` 生成二维码。

---

## 9. `children/`：孩子档案与历史

```text
children/
├── index.html      # 孩子档案页
├── page.js         # 档案页交互
├── children.css    # 档案页样式
├── history.html    # 历史记录页
└── history.js      # 历史记录筛选和展示
```

通用档案逻辑位于：

```text
assets/children.js
assets/blindspots.js
```

功能包括：

- 多孩子档案；
- 设置当前孩子；
- 按孩子保存诊断状态；
- 查看历史记录；
- 汇总薄弱点；
- 导出/导入 JSON 备份；
- 合并不同浏览器或设备中的档案数据。

当前数据保存在浏览器 `localStorage`，典型 key 为：

- `cnmChildren.v1`；
- `cnmChildren.records.v1`；
- `cnmBlind.local.v1`。

---

## 10. `scripts/`：数据构建、校验和发布脚本

`scripts/` 是开发阶段的数据生产目录，包含约 150 个 Python/JavaScript/Shell 文件。

### 10.1 总体职责

这些脚本负责：

- 编写或生成知识点；
- 生成先修边；
- 生成题目和干扰项；
- 生成课标条目与映射；
- 合并各学科数据；
- 传递约简冗余边；
- 校验 DAG、ID、题库和课标；
- 生成 PWA 图标；
- 无头浏览器截图和冒烟测试；
- 部署 Cloudflare Pages。

### 10.2 学科内容与构建脚本

| 学科/学段 | 典型文件 | 说明 |
|---|---|---|
| 小学数学 | `primary_*`、`g123_*`、`g1_*`、`g4_*`、`g5_*`、`g6_*` | 小学知识点、题目、年级对齐 |
| 初中/高中数学 | `hs_*`、`hs_book*`、`hs_sel_*` | 高中必修、选择性必修内容和边 |
| 小学英语 | `en_*` | 小学英语知识点、题目、教材 densify |
| 初中英语 | `enj_*` | 初中英语内容和跨学段边 |
| 高中英语 | `enh_*` | 高中英语必修、选择性必修 |
| 初中物理 | `phy_*`、`phy_g*` | 初中物理内容 |
| 高中物理 | `phy_hs_*` | 高中物理内容、课标、配图 |
| 小学语文 | `zh_*` | 小学语文内容和边 |
| 小学科学 | `sci_*` | 小学科学内容和边 |
| 道德与法治 | `mor_*`、`_gen_morality_content.py`、`_write_mor_grades.py` | 小学道德与法治内容 |
| 初中历史 | `his_*` | 历史知识点、边、题目和配图 |
| 初中地理 | `geo_*` | 地理知识点、边、题目和课标 |

### 10.3 主要构建入口

| 脚本 | 作用 | 是否适合重复运行 |
|---|---|---|
| `scripts/zh_build.py` | 编译小学语文 | 是，会替换本学科旧数据 |
| `scripts/sci_build.py` | 编译小学科学 | 是 |
| `scripts/mor_build.py` | 编译小学道德与法治 | 是 |
| `scripts/his_build.py` | 编译初中历史 | 是 |
| `scripts/geo_build.py` | 编译初中地理 | 是 |
| `scripts/phy_build.py` | 编译初中和高中物理 | 是，支持分段参数 |
| `scripts/en_build.py` | 编译小学英语 | 早期一次性追加脚本，重复运行会防护 |
| `scripts/enj_build.py` | 编译初中英语 | 早期追加型脚本 |
| `scripts/enh_build.py` | 编译高中英语 | 追加型脚本 |
| `scripts/hs_build.py` | 编译高中数学必修 | 一次性迁移脚本 |
| `scripts/hs_sel_build.py` | 编译高中数学选择性必修 | 一次性迁移脚本 |

> 重要：不是所有 `*_build.py` 都等价。历史、地理等较新的学科构建器通常会先删除旧学科数据再重建；早期高中数学、英语脚本多为一次性追加脚本。运行前必须阅读脚本头部说明。

### 10.4 校验脚本

| 脚本 | 作用 |
|---|---|
| `validate.py` | 校验正式 JSON 的结构、ID、边、DAG、题库、课标、学科边界等 |
| `verify_questions.py` | 用受限 Python 表达式核验题目答案，生成核验报告 |
| `check_figures.py` | 检查题目内联配图 |
| `moe2025_check.py` | 检查 2025 修订版课标对齐情况 |
| `phy_hs_check.py` | 检查高中物理内容、册次、先修关系等 |

最常用命令：

```bash
python3 scripts/validate.py
python3 scripts/verify_questions.py
```

### 10.5 题目生成与复核

典型文件：

- `primary_qgen.py`：小学数学题生成辅助；
- `second_pass.py`：第二轮独立复核辅助；
- `engine_norm.py`：题目或答案规范化；
- `en_distractors2/`：英语选择题干扰项修订；
- `_distractor_changelog.json` 的相关生成和修订脚本。

### 10.6 配图脚本

典型文件：

- `fig_draw.py`；
- `add_figures.py`；
- `his_figs.py`；
- `phy_fig.py`；
- `phy_hs_figs*.py`。

这些脚本用于生成或维护题目中的内联 SVG 示意图。

### 10.7 工具与部署

| 文件 | 作用 |
|---|---|
| `screenshot.js` | 启动本地 HTTP 服务和无头 Chrome，做冒烟测试、生成截图 |
| `deploy-cf.sh` | 打包静态站点并部署到 Cloudflare Pages |
| `make_pwa_icons.py` | 生成 PWA 图标 |
| `demo_grade.js` | 年级演示/诊断辅助脚本 |

`deploy-cf.sh` 只部署运行所需文件：

- 根目录 HTML、PWA 文件；
- `assets/`、`explore/`、`diagnose/`、`children/`；
- `data/` 下五个正式 JSON：`topics.json`、`dependencies.json`、`questions.json`、`cn-curriculum-standards.json`、`id-aliases.json`。

不会部署：

- `screenshots/`；
- `data/_qbatches/`；
- `data/_second_pass/`；
- 大部分脚本和开发材料。

### 10.8 `scripts/vendor/` 与 `__pycache__/`

- `vendor/`：Python 侧可能使用的本地第三方或辅助代码；
- `__pycache__/`：Python 运行后生成的字节码缓存，不是源代码，不应手工编辑。

---

## 11. `tests/`：自动化测试

```text
tests/
├── test_engine.js             # 诊断引擎测试
├── test_children.js           # 孩子档案与备份恢复测试
├── test_blindspots.js         # 薄弱点账本测试
└── test_children_browser.js   # 隔离浏览器中的备份恢复和布局测试
```

### `test_engine.js`

覆盖诊断引擎核心规则：

- 图构建；
- 祖先和拓扑排序；
- hard/soft 边顺序；
- 出题序列；
- 掌握、薄弱、不稳状态；
- 题量上限；
- 根因和学习路径；
- 整册/整年级筛查；
- 判题器；
- 真实数据完整性。

### `test_children.js`

使用 Node VM 模拟 localStorage，测试：

- 多孩子档案；
- 诊断历史；
- JSON 备份；
- 导入合并；
- 异常数据拒绝；
- 配额失败回滚；
- 数据结构版本。

### `test_blindspots.js`

测试本机错题和薄弱点汇总逻辑。

### `test_children_browser.js`

使用本机 Chrome/Chromium 做隔离浏览器测试，覆盖真实下载、导入、历史展示、移动端布局等。

运行方式：

```bash
node tests/test_engine.js
node tests/test_children.js
node tests/test_blindspots.js
node tests/test_children_browser.js
```

---

## 12. `screenshots/`：截图和视觉参考

存放：

- 首页截图；
- 知识图谱截图；
- 诊断流程截图；
- 移动端 375px 宽截图；
- 分享图截图；
- 高中物理配图；
- 历史学科示意图。

这些图片主要用于：

- README 展示；
- 视觉回归参考；
- Issue 复现；
- 产品效果对比。

该目录不参与线上核心逻辑，也不会被 Cloudflare 部署脚本打包。

---

## 13. `docs/`：专题文档

```text
docs/
├── edition-mappings.md          # 教材版本映射说明
├── english_review_report.md     # 英语内容复核报告
├── moe2025-alignment.md         # 2025 修订版课标对齐说明
├── physics-senior-mapping.md    # 高中物理教材/课标映射
├── project-structure.md         # 当前目录结构说明
├── pwa.md                       # PWA 和统计说明
├── questions.md                 # 题库格式、核验和局限
└── standards-mapping.md         # 课标映射规则和覆盖情况
```

---

## 14. `.github/`：GitHub 协作配置

```text
.github/
└── ISSUE_TEMPLATE/
    ├── config.yml
    ├── feature-request.yml
    └── question-fix.yml
```

用于 GitHub Issue 分类和提问模板，不参与网站运行。

---

## 15. 运行时数据流

### 15.1 知识图谱浏览

```text
explore/index.html
      ↓
explore/app.js
      ↓
fetch data/topics.json + dependencies.json + standards + aliases
      ↓
浏览器内筛选当前学科并组装 nodes/edges
      ↓
Cytoscape.js + dagre 渲染局部图
```

### 15.2 自适应诊断

```text
diagnose/index.html
      ↓
diagnose/app.js 加载正式 JSON 和题库
      ↓
DiagEngine.buildGraph()
      ↓
createSession()
      ↓
nextItem() 出题
      ↓
applyAnswer() 更新掌握状态
      ↓
summarize() 输出根因和路径
      ↓
结果页、路径图、分享图、本机档案记录
```

### 15.3 数据构建

较新的可重建学科通常遵循：

```text
学科内容源脚本，例如 geo_g7.py / geo_g8.py
学科边脚本，例如 geo_edges.py
学科公共库，例如 geo_lib.py
      ↓
学科构建器，例如 geo_build.py
      ↓
读取旧 data/*.json
删除旧学科节点/边/题目/课标
生成新学科数据
拓扑排序与冗余边约简
题目答案核验
      ↓
写回 data/topics.json 等正式 JSON
      ↓
python3 scripts/validate.py
      ↓
node tests/test_engine.js
```

---

## 16. 本地开发常用命令

### 启动静态网站

不能直接用 `file://` 打开，因为页面依赖 `fetch()` 加载 JSON：

```bash
cd /Users/zhanglei/MyProjects/cn-math-taxonomy
python3 -m http.server 8000
```

访问：

- 首页：`http://localhost:8000/`
- 图谱：`http://localhost:8000/explore/`
- 诊断：`http://localhost:8000/diagnose/`
- 档案：`http://localhost:8000/children/`

### 校验数据

```bash
python3 scripts/validate.py
python3 scripts/verify_questions.py
```

### 运行前端引擎和存储测试

```bash
node tests/test_engine.js
node tests/test_children.js
node tests/test_blindspots.js
```

浏览器测试需要本机可用 Chrome/Chromium：

```bash
node tests/test_children_browser.js
```

### 生成截图/冒烟测试

```bash
node scripts/screenshot.js
```

### 部署 Cloudflare Pages

```bash
./scripts/deploy-cf.sh
```

需要配置 Cloudflare API Token。部署前应先完成数据校验和测试。

---

## 17. 维护注意事项

1. **不要手工随意改正式 JSON 的 ID**。ID 被先修边、题目、历史记录、别名和 URL hash 引用。
2. **删除或改名知识点时更新 `id-aliases.json`**，避免旧链接失效。
3. **新增知识点必须补题目和课标映射**，并运行 `validate.py`。
4. **新增先修边后必须检查 DAG 是否有环**，不能出现循环先修。
5. **跨学科先修边默认禁止**。物理对数学的依赖应放在 `mathLinks` 等字段中。
6. **早期一次性构建脚本不要重复执行**，运行前查看文件头部说明。
7. **正式题库答案不要只依赖前端判题**。当前静态网站适合演示和个人使用；公众产品化后应由服务端出题、判题和保存结果。
8. **`screenshots/`、`_qbatches/`、`_second_pass/` 是开发材料**，不是学生端运行必需文件。
9. **当前 `package.json` 的 `test` 脚本仍是占位**，CI 中应直接调用真实测试命令或后续补齐 npm scripts。
10. **当前前端没有模块化构建系统**，新增全局 JS 时要注意加载顺序和全局命名冲突。

---

## 18. 面向未来产品化的目录演进建议

如果未来重构为 `Vue 3 + Node.js + PostgreSQL` 的公众网站，建议演进为：

```text
apps/
├── web/        # Vue 3 用户端
├── admin/      # 教师/内容管理后台
└── api/        # Node.js API

packages/
├── engine/     # 诊断引擎，共享给前端和 API
├── schema/     # 数据模型与校验
└── ui/         # 共享 UI 组件

content/        # YAML/CSV/Markdown 形式的内容源
migrations/     # PostgreSQL 迁移
scripts/        # 数据导入、构建、校验、分析脚本
data/           # 临时或历史静态数据，逐步从权威存储降级为发布制品
```

在该架构下：

- PostgreSQL 保存权威知识点、边、题目、课标和用户记录；
- Node.js 提供诊断、判题、同步和管理 API；
- Vue 3 负责图谱浏览、诊断和档案界面；
- 构建器继续生成只读 JSON 包并发布到 CDN；
- 现有 `diagnose/engine.js` 可迁移为 TypeScript 共享包；
- Cytoscape.js 可继续使用，也可评估 AntV G6/X6 或 Vue Flow。
