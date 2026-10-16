# 架构与数据契约

## 当前边界

仅移动端、个人使用、Local-first，无登录及远程服务器。当前开放首页、知识体系、增长率课程与 5 题练习，宽屏沿用最大 480px 的移动布局。错题本和报告是后续切片。

## 分层与数据流

- `src/domain`：纯 TypeScript 类型、Zod Schema 和目录关联校验。允许依赖 Zod，独立于 UI 与数据库。
- `src/data`：Dexie 表、种子初始化和仓储。负责事务、外键校验与不可变内容版本。
- `src/features`：移动端功能页面，通过仓储和目录 Context 获取数据。
- `src/app`：路由、初始化状态、主题、应用壳和全局视觉变量。Zustand 只管理主题等界面状态。
- `src/components/ui`：官方 shadcn/ui CLI 生成的基础组件源码；页面通过 Tailwind 工具类组合使用，组件来源和样式约束见 `AGENTS.md`。

启动 → 初始化事务补齐目录及增长率内容版本 → 仓储读取并校验目录 → Context 提供页面数据。初始化核对内置内容的知识点与例题引用，已存在版本与内置版本内容冲突时报错并保留现场。失败显示错误与重试入口，成功后才显示目录。首页不使用模拟学习数据。

## 核心模型

所有实体都有 strict Zod Schema；持久化写入与仓储读取均校验。Zod 校验形状，仓储校验跨实体引用。

| 实体             | 主键与关系                                      | 规则                                                        |
| ---------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| ExamProfile      | id                                              | 地区、适用年份、大纲来源、核对日期                          |
| Module           | id → examProfileId                              | 官方分类，order 控制顺序                                    |
| KnowledgePoint   | id → moduleId / parentId                        | 自建教学树，同模块父子关系，无循环                          |
| Lesson           | [id, version] → knowledgePointId                | Markdown 内容、例题版本引用、来源与审核                     |
| LessonProgress   | lessonId → lessonVersion                        | 未开始、学习中、已完成、初步掌握；保存学习时的版本          |
| Question         | [id, version] → knowledgePointIds / materialRef | 多对多知识关联；单选与多选；Markdown 支持后续图片、公式渲染 |
| QuestionMaterial | [id, version]                                   | 多题共享材料，内容版本独立保留                              |
| PracticeSession  | id → questionRefs                               | 冻结题目顺序与版本；保存草稿、题号、不确定标记、累计耗时    |
| AnswerRecord     | id → sessionId / questionRef                    | 追加历史；同会话同题唯一；校验结果与冻结版本一致            |
| MistakeState     | questionId                                      | 复习状态、错误原因；错误次数和最近错误答案由作答历史计算    |

课程、题目和材料分别保存来源、地区、年份、许可状态、内容版本、审核状态。许可状态为 unknown / permitted / restricted；审核状态为 draft / reviewed / verified。两者不互相推导。只有 verified 且 permitted 的题目及关联材料可创建训练会话。

## 存储与接口

数据库名 `kaogong-learning`，版本 1。内容表使用 `[id+version]` 复合主键；答题表使用唯一 `[sessionId+questionRef.id]` 索引。种子事务只补齐缺失目录和增长率内容版本，校验合并后的目录，保留已有条目和全部学习数据；seed-v1 元数据记录首次初始化时间。

- CatalogRepository：读取目录、学习进度，保存学习进度与错题状态。
- ContentRepository：增加课程、题目和材料版本，按版本读取题目和材料。相同版本相同内容幂等，变更内容必须增加版本号。
- PracticeRepository：创建、保存、恢复会话，追加与读取作答记录。保存会话不能改变题目顺序、版本、开始时间或解析模式；已完成会话不可修改。

`appendAnswer` 不接受由调用方决定的提交序号：仓储按稳定题目 ID 计算 `attemptNumber`，跨版本和会话累计，包含未作答提交。序号 1 表示首次提交；后续统计必须明确区分首次提交、重复提交及未作答，不能把未作答当成已完成题数。数据库事务保证并发提交只记账一次。

`submitSession` 根据已保存草稿，在单一事务中批改并写入全套答案、错误题的待复习状态与会话完成时间。未作答仍有独立记录，重复提交返回已有结果，不再次记账；失败回滚后可重试。练习页面不通过逐条 `appendAnswer` 交卷。`saveSession` 不允许直接把进行中会话改为已完成。

`buildGrowthRateSession` 从至少五道已审核、获许可的增长率单选题中取五道，冻结顺序和版本；新增合格题目不会阻断已有练习。`advanceSessionTime` 纯函数累计当前题用时，`summarizeAnswers` 和 `summarizePracticeHistory` 分别计算本套结果、按难度区分的首次与重复作答正确数、中位用时和不确定标记次数。答题页面在切题、选择、定时更新、标签页隐藏及页面退出时尽力保存累计用时，后台标签页暂停计时；结果页按会话冻结版本读取解析。浏览器强制关闭时最后不足一秒的计时写入无法保证，但最近一次已保存的用时仍可恢复。5 题样本不推断稳定正确率或薄弱模块。

课程页面只显示最新的 verified 且 permitted 版本；若版本更新，当前学习进度重新进入 learning 并引用新版本。Markdown 数学公式由 KaTeX 输出 MathML，样式使用 Tailwind 工具类，不增加全局 CSS 入口。

## 迁移与安全恢复

未来结构变化增加 Dexie version，提供对应迁移测试。内容更新新增版本，暂不提供删除内容或历史的公共接口。已有目录校验失败时保留数据库现场并提示错误；重试只重新初始化，不清空数据库。

数据仅属于当前浏览器与站点来源。当前尚未实现备份、导入导出或跨设备同步。自动化测试使用独立临时数据库，测试题不进入应用种子。
