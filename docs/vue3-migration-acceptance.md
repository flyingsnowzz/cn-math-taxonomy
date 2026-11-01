# Vue 3 展示层迁移验收记录

更新时间：2026-11-02（Asia/Shanghai）

## 范围

新前端位于 `web/`，技术栈为 Vue 3 + Vite + TypeScript + Vue Router + Pinia + Tailwind CSS + Cytoscape.js。

本次迁移保持以下边界：

- 根目录 Python 知识图谱/题库构建脚本未修改；
- 根目录正式 `data/*.json` 内容未修改；
- 未引入 Node 后端或数据库；
- 旧版静态页面仍保留，可作为回滚方案；
- 未执行生产部署。

## 自动化证据

在 `web/` 下执行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

当前结果：

- ESLint：通过；
- `vue-tsc --noEmit`：通过；
- Vitest：6 个测试文件、11 个测试通过；
- Playwright：53 个 E2E 测试通过；
- 生产构建：通过。

根目录旧数据和旧引擎回归：

```bash
python3 scripts/validate.py
node tests/test_engine.js
node tests/test_children.js
node tests/test_blindspots.js
```

结果：

- 正式数据校验：`VALIDATION PASSED`；
- 旧诊断引擎：92 项通过；
- 旧孩子档案逻辑：35 项通过；
- 旧盲区逻辑：7 项通过。

## 完成定义核对

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| 新 Vue 3 应用可在 `web/` 独立启动和构建 | 已完成 | `npm run dev`、`npm run build` |
| 首页、知识图谱、诊断、孩子档案核心页面迁移 | 已完成 | `src/pages/*` |
| 旧核心 URL 和分享链接可访问或正确跳转 | 已完成 | Router alias、legacy redirects、E2E |
| 正式 JSON 数据无需修改即可读取 | 已完成 | `scripts/build-data-packages.mjs` 从根目录数据生成 |
| 图谱展示节点、hard/soft 边和局部层级 | 已完成 | Cytoscape 组件和 E2E |
| 诊断引擎与旧规则一致 | 已完成 | 迁移旧确定性引擎；旧引擎 92 项测试通过 |
| 单点、整章、整册/整年级诊断可运行 | 已完成 | Store 与 E2E 覆盖 |
| localStorage 会话和孩子档案可迁移读取 | 已完成 | 兼容旧 key，E2E 覆盖备份导入 |
| 备份导入导出兼容 | 已完成 | 复用旧档案逻辑，E2E 覆盖导入和历史 |
| PWA 构建和离线策略验证 | 已完成 | 生成式 Service Worker，E2E 覆盖离线刷新 |
| 桌面端和 375px 移动端核心流程可用 | 已完成 | 10 个 visual smoke 测试 |
| `python3 scripts/validate.py` 继续通过 | 已完成 | `VALIDATION PASSED`；CI 增加 legacy regression job |
| 类型检查、lint、单元测试、生产构建通过 | 已完成 | 全部通过 |
| 新版可部署到静态预览环境 | 已具备脚本，未执行 | `scripts/deploy-preview-cloudflare.sh` |
| 旧站点保留可回滚 | 已完成 | 根目录旧页面未删除 |
| 没有未经审核的数据结构、诊断规则或生产部署变更 | 已完成 | 未改数据/规则，未部署生产 |

## 已覆盖的关键用户路径

1. 首页读取学科统计并跳转图谱；
2. 旧 hash `/#cnm_221` 跳转数学图谱；
3. 知识图谱按学科、年级、领域、关键词、深度浏览；
4. 知识点详情展示教材、掌握标准、课标、样题；
5. 单点诊断、多目标诊断、演示诊断；
6. 整章诊断和整册/年级筛查；
7. 选择/填空答题、自动判题、手动确认、跳过；
8. 结果页展示掌握、不稳、薄弱、未测、根因和路径；
9. 可配置单点/整章题量、整体筛查题量和每知识点确认题数；
10. 筛查达到题量上限后可继续加题；
11. 已出题 ID 写入旧版 `cnmDiagnose.seen.v1`，后续诊断默认避开；
12. Canvas 分享海报；
13. JSON 导出和打印；
14. 孩子档案新增、编辑、删除、备份导入；
15. 孩子历史筛选、再测和删除单条记录；
16. 本机盲区账本和一键再测；
17. PWA 离线刷新；
15. 桌面端与移动端无横向溢出；
16. 英语学科独立图谱包加载，诊断时才加载题库包。

## 仍需人工确认

1. 视觉是否达到可替换旧站的产品标准；
2. 是否执行 Cloudflare Pages 预览部署；
3. 预览域名通过后是否授权生产切换；
4. 旧版根目录页面保留时长和归档方式；
5. GitHub Actions 在远端仓库的实际运行结果。
