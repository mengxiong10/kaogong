# 开发约定

## 当前目标

按切片交付湖北省考行测个人学习工具。当前仅开发移动端，验收宽度为 360、390、430px；宽屏复用居中的移动布局。最新用户决定优先于 PRD 中的 PC 要求。

## 工作入口

- 开始任务前阅读 `docs/plan.md`，确认当前切片范围、状态与验收标准；产品意图查 `prd.md`。
- 修改分层、模型、仓储或数据库时阅读 `docs/architecture.md`。
- 修改目录或内容流水线时阅读 `docs/content.md` 与 `content-pipeline/README.md`。
- 环境启动与验收命令查 `README.md` 和 `package.json`。

## 实现约束

- `domain` 保持纯 TypeScript；`data` 负责校验和持久化；功能页面通过仓储访问数据。Zustand 用于界面状态。
- 使用稳定 ID 和内容版本引用；题目变更保留旧版本，作答历史只追加。统计必须源于真实记录。
- 初始化与重试保留现有用户数据；写入使用事务和 Zod 校验。
- 教学目录与官方分类分开记录；许可状态与内容审核状态分开记录。
- 新增关键领域逻辑同步增加单元测试；修改持久化行为验证事务、重试与历史保留。

## UI 与工具约定

- 基础 UI 组件使用官方 shadcn/ui，通过 `pnpm ui:add <组件名>` 生成到 `src/components/ui`；不要自行创建或仿写 Button、Input、Dialog 等基础组件。业务页面可组合这些组件。
- 页面布局和样式使用 Tailwind 工具类；不要新增 CSS / SCSS / CSS Modules 文件，不要手写页面选择器或行内 style。唯一全局入口 `src/app/styles.css` 仅保留 Tailwind / shadcn 导入、主题变量和官方基础层。
- 使用 Prettier 统一格式与 Tailwind 类名排序，使用 ESLint 检查 TypeScript、React Hooks 与热更新边界；配置与命令见 `package.json`。

## 完成条件

执行任务相关检查；切片交付执行 `pnpm check`。在 `docs/plan.md` 记录真实结果、未完成项和下一计划；模型或业务约定变化同步更新对应文档。检查未通过或未运行时明确说明原因。
