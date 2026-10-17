# 湖北行测 · 学习工作台

面向个人备考的移动端、Local-first 学习应用。当前六大模块的 47 个知识点均有课程，并可练习私人真题；错题本支持筛选、归因、重做和手动标记掌握。首页根据真实进度推荐今日学习内容，未交卷练习可独立继续；学习概况和详细报告汇总真实作答、课程进度和近期练习记录。

## 启动

使用 Node.js 22.12+、pnpm 10。

```sh
pnpm install
pnpm dev
```

打开终端显示的本地地址。宽屏显示居中的移动布局。应用无登录、无远程服务器；数据保存在当前浏览器的 IndexedDB，主题偏好保存在 localStorage。首页「备份与恢复学习记录」可下载本地 JSON 备份并预览合并恢复；清除站点数据前请自行保存备份文件。备份不加密，不含整套题库、图片或主题偏好；恢复依赖应用保留历史图片资源。当前没有多设备同步。

学习路径：知识体系 → 选择模块与知识点 → 阅读课程 → 开始对应真题练习 → 交卷看解析 → 错题本复习；也可从“专项练习”选择模块。每套最多 5 题，保留共享材料与图片。练习中可切题、跳过和标记不确定；草稿和计时定期保存，刷新后从练习列表继续。答错题自动进入错题本，按模块与知识点筛选；可记录单个错误原因、重做并手动标记掌握，再次答错会重新待复习。首页的学习概况显示最近 10 套已完成练习的首次作答正确率、待复习错题和已完成课程；`/analytics` 展示首次/重做、模块/知识点与近期记录明细。首次与重复作答分别计数，历史记录不会被重做覆盖。真题答案来自上游、未经独立核验；难度未标定。原有原创题练习会话和作答历史继续保留。

内置目录、课程与课程例题位于 `src/content/*.json`；首期资料分析包位于 `public/content/bank/`，新增六模块题包位于 `public/content/all-bank/`，由 `content-pipeline` 从同一固定上游提交生成。六模块题包在首次进入对应模块练习时按模块导入，失败可重试，已有学习记录保留。`src/data` 只负责校验、事务导入和仓储。2026-10-17 用户确认拥有公开发布所需授权，并要求推送和部署；项目未独立核验授权凭据，内容中的 `license: unknown` 与答案审核状态保持原样。题目来源、许可和校验状态见 [内容依据](docs/content.md)。

## UI 与开发工具

基础组件使用官方 [shadcn/ui](https://ui.shadcn.com/docs/installation/vite)，通过 `pnpm ui:add <组件名>` 添加；页面使用 Tailwind 工具类。具体约束见 [开发约定](AGENTS.md)。`components.json` 配置组件生成路径与别名，全局 CSS 仅承载 Tailwind / shadcn 主题。

已配置 ESLint flat config、Prettier（含 Tailwind 类名排序）与 EditorConfig。编辑后运行 `pnpm format` 自动格式化、`pnpm lint:fix` 修复可自动处理的问题；`pnpm check` 包含格式、Lint 与原有全部验收。TypeScript 使用 typescript-eslint 支持的 6.0 版本。

## 验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm content:check
pnpm exec playwright install chromium
pnpm test:e2e
# 全部验收
pnpm check
```

Playwright 自动启动独立 Vite 服务，在 360、390、430px 下运行 Chromium 测试。

## PWA 与 GitHub Pages

生产构建生成安装清单、图标、`sw.js` 和 `404.html`。首次在线打开后，应用代码可离线使用；首次在线导入的题目保存在当前浏览器 IndexedDB，已访问的题包资源及图片按需缓存（最多 120 项），不会预下载约 438 MB 的私人题包。离线使用前须在线完成首次初始化。更新在关闭所有旧页面后生效；备份学习记录仍需手动操作。

`main` 推送触发 `.github/workflows/deploy-pages.yml`，使用 Node 22 / pnpm 10 进行内容校验、单元测试及 Pages 构建，并上传 `dist`。构建时 `GITHUB_PAGES=true` 设置 `/kaogong/` 子路径，`404.html` 支持直接打开深层路由。本机可用 `GITHUB_PAGES=true pnpm build` 与 `GITHUB_PAGES=true pnpm preview` 预览。

**发布依据：** 用户于 2026-10-17 确认拥有上述内容的公开发布授权，并要求将完整构建发布到 GitHub Pages。项目只记录该确认，未独立查验许可文件；`unknown` 标记保留，表示原始来源许可仍未核实。

## 文档

- [PRD](prd.md)：完整产品需求。
- [开发约定](AGENTS.md)：Agent 工作入口和完成要求。
- [架构与数据契约](docs/architecture.md)：分层、持久化、历史版本规则。
- [切片计划与验收](docs/plan.md)：当前任务状态、检查证据、下一计划。
- [内容依据](docs/content.md)：大纲来源与自建教学分类。
- [内容流水线](content-pipeline/README.md)：离线内容生产职责。
