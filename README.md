# 湖北行测 · 学习工作台

面向个人备考的移动端、Local-first 学习应用。当前完成第一切片：知识目录与本地数据底座；课程、练习和报告按后续切片交付。

## 启动

使用 Node.js 22.12+、pnpm 10。

```sh
pnpm install
pnpm dev
```

打开终端显示的本地地址。宽屏显示居中的移动布局。应用无登录、无远程服务器；数据保存在当前浏览器的 IndexedDB，主题偏好保存在 localStorage。清除站点数据会删除本地记录，当前没有备份或多设备同步。

## UI 与开发工具

基础组件使用官方 [shadcn/ui](https://ui.shadcn.com/docs/installation/vite)，通过 `pnpm ui:add <组件名>` 添加；页面使用 Tailwind 工具类。具体约束见 [开发约定](AGENTS.md)。`components.json` 配置组件生成路径与别名，全局 CSS 仅承载 Tailwind / shadcn 主题。

已配置 ESLint flat config、Prettier（含 Tailwind 类名排序）与 EditorConfig。编辑后运行 `pnpm format` 自动格式化、`pnpm lint:fix` 修复可自动处理的问题；`pnpm check` 包含格式、Lint 与原有全部验收。TypeScript 使用 typescript-eslint 支持的 6.0 版本。

## 验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
# 全部验收
pnpm check
```

Playwright 自动启动独立 Vite 服务，在 360、390、430px 下运行 Chromium 测试。部署需支持 SPA 路由回退到 `index.html`。本切片验证本地运行与生产构建，未部署云端。

## 文档

- [PRD](prd.md)：完整产品需求。
- [开发约定](AGENTS.md)：Agent 工作入口和完成要求。
- [架构与数据契约](docs/architecture.md)：分层、持久化、历史版本规则。
- [切片计划与验收](docs/plan.md)：当前任务状态、检查证据、下一计划。
- [内容依据](docs/content.md)：大纲来源与自建教学分类。
- [内容流水线](content-pipeline/README.md)：离线内容生产职责。
